#!/usr/bin/env python3
"""
VPS intra-day bot: scrape PolicyDen (sales) and WeGenerate (calls), merge into
dashboard snapshots via API. Run every 5 min via cron.

The dashboard Agent Performance card uses the latest snapshot per agent; there is
no manual intra-day entry and no intra-performance alert.

Requires on VPS: .env (API_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD),
auth_policyden.json, auth_wegenerate.json, agent_map.json.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv

from auth_login import login_and_save_async
from http_retry import request_with_retries

# Optional: reduce detection on datacenter IPs
try:
    from playwright_stealth import stealth_async
except ImportError:
    stealth_async = None

# --- Config (match dashboard) ---
ZONE = "America/New_York"
SLOT_CONFIG = [
    {"key": "11:00", "label": "11:00 AM", "minute_of_day": 11 * 60},
    {"key": "13:00", "label": "1:00 PM", "minute_of_day": 13 * 60},
    {"key": "15:00", "label": "3:00 PM", "minute_of_day": 15 * 60},
    {"key": "17:00", "label": "5:00 PM", "minute_of_day": 17 * 60},
]
POLICYDEN_LOGIN = "https://app.policyden.com/login"
POLICYDEN_POLICIES = "https://app.policyden.com/policies"
POLICYDEN_DASHBOARD = "https://app.policyden.com/dashboard"
WEGENERATE_LOGIN = "https://app.wegenerate.com/login"
WEGENERATE_DASHBOARD = "https://app.wegenerate.com/dashboard"

# --- Selectors ---
# PolicyDen: use dashboard date picker + "Open Live View"; live view leaderboard: RANK(0), AGENT(1), SALES(2)
SELECTORS_POLICYDEN = {
    "open_live_view": 'button:has-text("Open Live View")',
    "table_rows": "table tbody tr",
    "col_agent": 1,   # AGENT column (name + email)
    "col_sales": 2,   # SALES column (e.g. 6)
}

# PolicyDen date picker: use set_policyden_date_on_page (codegen flow: combobox + day button name).
SELECTORS_POLICYDEN_DATE = {
    "date_trigger": "button#date",
    "date_trigger_fallbacks": ["[data-slot='popover-trigger'][id='date']"],
    "date_apply": "button:has-text('Apply')",
}
# WeGenerate /dashboard: table is inside a card "Agent Performance"; must open date picker, click Today, Apply to load data.
# Per-agent marketing: td with class font-bold in each row (e.g. $201.00). Campaign Performance: marketing $ in a td with font-bold (e.g. $2,695.00).
SELECTORS_WEGENERATE = {
    "date_trigger": "button#date",
    "date_apply": "button:has-text('Apply')",
    "date_picker_today_ok": True,
    "prev_month": "button[aria-label='Previous page']",
    "next_month": "button[aria-label='Next page']",
    "card_heading": "h3:has-text('Agent Performance')",
    "table_rows": "div:has(h3:has-text('Agent Performance')) table tbody tr",
    "table_rows_fallbacks": [
        "table tbody tr",
        "table tr",
        "tr:has(td[class*='align-middle'])",
        "tr:has(td.font-medium)",
        "[role='row']",
        "[role='grid'] [role='row']",
    ],
    "col_agent": 1,   # Agent column
    "col_calls": 2,   # Billable column
    "col_marketing": 4,  # Marketing column (Rank=0, Agent=1, Billable=2, Sales=3, Marketing=4, CPA=5)
    "campaign_marketing_cell": "td.font-bold",  # Campaign Performance table: cell with $ amount
    "campaign_marketing_fallbacks": ["td[class*='font-bold']", "[class*='font-bold']"],
}


def log(msg: str) -> None:
    print(msg, flush=True)


def get_date_key_est() -> str:
    from datetime import datetime
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(ZONE)
    return datetime.now(tz).strftime("%Y-%m-%d")


def get_current_slot() -> tuple[str, str]:
    """Return (slot_key, slot_label) for the current EST time."""
    from datetime import datetime
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(ZONE)
    now = datetime.now(tz)
    minute_of_day = now.hour * 60 + now.minute
    chosen = None
    for slot in SLOT_CONFIG:
        if minute_of_day >= slot["minute_of_day"]:
            chosen = slot
    if chosen is None:
        chosen = SLOT_CONFIG[0]
    return chosen["key"], chosen["label"]


def load_agent_map(bot_dir: Path) -> dict[str, str]:
    """Load agent_map.json: { "Display Name": "agent-uuid" }."""
    path = bot_dir / "agent_map.json"
    if not path.exists():
        log("WARNING: agent_map.json not found; no snapshots will be pushed.")
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        log(f"ERROR: agent_map.json has invalid JSON: {e}")
        log("  Use double quotes for keys/values, no trailing commas, no comments.")
        log("  Example: {\"Agent Name\": \"agent-uuid-here\"}")
        raise


# Month names for calendar navigation (1-based index)
_MONTH_NAMES = (
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


async def _navigate_calendar_to_month(page, popover, date_key: str, selectors: dict) -> None:
    """Click prev_month or next_month until the calendar shows the month for date_key (e.g. WeGenerate)."""
    from datetime import datetime
    from zoneinfo import ZoneInfo
    try:
        prev_sel = selectors.get("prev_month")
        next_sel = selectors.get("next_month")
        if not prev_sel and not next_sel:
            return
        parts = date_key.split("-")
        if len(parts) != 3:
            return
        target_year = int(parts[0])
        target_month = int(parts[1])
        now = datetime.now(ZoneInfo(ZONE))
        cur_year, cur_month = now.year, now.month
        months_diff = (cur_year - target_year) * 12 + (cur_month - target_month)
        if months_diff == 0:
            return
        container = popover if await popover.locator(prev_sel or next_sel).count() > 0 else page
        for _ in range(abs(months_diff)):
            if months_diff > 0 and prev_sel:
                try:
                    await container.locator(prev_sel).first.click(timeout=2000)
                    await page.wait_for_timeout(400)
                except Exception:
                    break
            elif months_diff < 0 and next_sel:
                try:
                    await container.locator(next_sel).first.click(timeout=2000)
                    await page.wait_for_timeout(400)
                except Exception:
                    break
    except Exception:
        pass


async def _set_calendar_month_only_in_popover(popover, date_key: str) -> bool:
    """Set only the month dropdown(s) in a range picker (e.g. PolicyDen). Year left as-is."""
    try:
        parts = date_key.split("-")
        if len(parts) != 3:
            return False
        month_num = int(parts[1])
        if month_num < 1 or month_num > 12:
            return False
        month_name = _MONTH_NAMES[month_num]

        triggers = await popover.locator('[data-slot="select-trigger"]').all()
        p = popover.page
        for t in triggers:
            text = (await t.inner_text() or "").strip()
            if text in _MONTH_NAMES[1:]:
                await t.click(timeout=3000)
                await p.wait_for_timeout(400)
                month_opt = p.locator(f'[role="option"]:has-text("{month_name}")').first
                if await month_opt.count() > 0:
                    await month_opt.click(timeout=2000)
                    await p.wait_for_timeout(300)
                else:
                    await p.keyboard.press("Escape")
                    await p.wait_for_timeout(200)
        return True
    except Exception:
        return False


async def set_date_on_page(page, date_key: str, selectors: dict) -> bool:
    """Optional: open date picker, select date_key, click Apply. Return True if done."""
    if not selectors.get("date_apply"):
        log("  Date apply selector not configured; skipping date filter (using page default).")
        return False
    triggers = [selectors.get("date_trigger")]
    if selectors.get("date_trigger_fallbacks"):
        triggers = [t for t in triggers if t] + list(selectors["date_trigger_fallbacks"])
    trigger_clicked = False
    for trigger_sel in triggers:
        try:
            await page.click(trigger_sel, timeout=4000)
            trigger_clicked = True
            break
        except Exception:
            continue
    if not trigger_clicked:
        log("  Date picker: could not open (trigger not found). Scraping page default date.")
        return False
    try:
        await page.wait_for_timeout(600)
        popover = page.locator('[id^="reka-popover-content-"], [role="dialog"]').first
        try:
            await popover.wait_for(state="visible", timeout=4000)
        except Exception:
            pass
        await page.wait_for_timeout(400)

        try_today = selectors.get("date_picker_today_ok", False) and (date_key == get_date_key_est())
        if try_today:
            today_selectors = (
                'button:has-text("Today")',
                'button.bg-primary-500:has-text("Today")',
                '[data-slot="button"]:has-text("Today")',
            )
            for today_sel in today_selectors:
                try:
                    loc = popover.locator(today_sel)
                    if await loc.count() == 0:
                        loc = page.locator(today_sel)
                    if await loc.count() > 0:
                        await loc.first.click(timeout=2000)
                        await page.wait_for_timeout(600)
                        break
                except Exception:
                    continue

        if selectors.get("date_picker_use_month_dropdown"):
            await _set_calendar_month_only_in_popover(popover, date_key)
            await page.wait_for_timeout(500)

        if selectors.get("prev_month") and date_key != get_date_key_est():
            await _navigate_calendar_to_month(page, popover, date_key, selectors)
            await page.wait_for_timeout(500)

        day = date_key.split("-")[2].lstrip("0") or "1"
        day_sel = (
            f'[data-value="{date_key}"]',
            f'[data-date="{date_key}"]',
            f'button[data-value="{date_key}"]',
            f'[data-slot="calendar-cell-trigger"][data-value="{date_key}"]',
            f'[role="gridcell"]:has-text("{day}")',
            f'button:has-text("{day}")',
        )
        clicked_day = False
        for sel in day_sel:
            try:
                loc = popover.locator(sel).first
                if await loc.count() > 0:
                    await loc.click(timeout=2000)
                    clicked_day = True
                    break
            except Exception:
                continue
        if not clicked_day:
            await page.wait_for_timeout(300)
            for sel in day_sel[:4]:
                try:
                    loc = popover.locator(sel).first
                    if await loc.count() > 0:
                        await loc.click(timeout=2000)
                        clicked_day = True
                        break
                except Exception:
                    continue

        if clicked_day and selectors.get("date_picker_range_select_both"):
            await page.wait_for_timeout(300)
            for sel in day_sel[:4]:
                try:
                    loc = popover.locator(sel)
                    if await loc.count() >= 2:
                        await loc.nth(1).click(timeout=2000)
                        break
                except Exception:
                    continue
        if clicked_day:
            await page.wait_for_timeout(400)

        apply_loc = popover.locator(selectors["date_apply"]).first
        if await apply_loc.count() == 0:
            apply_loc = page.locator(selectors["date_apply"]).first
        try:
            await apply_loc.wait_for(state="visible", timeout=3000)
            for _ in range(75):
                if await apply_loc.is_enabled():
                    break
                await page.wait_for_timeout(200)
            if not await apply_loc.is_enabled():
                log("  Apply button stayed disabled; date may not be selected.")
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(300)
                return False
            await apply_loc.click(timeout=5000)
        except Exception as e:
            log(f"  Apply button: {e}")
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)
            return False
        await page.wait_for_timeout(500)
        return True
    except Exception as e:
        log(f"  Date picker failed: {e}")
        return False


async def set_policyden_date_on_page(page, date_key: str) -> bool:
    """Set PolicyDen dashboard date using codegen flow: combobox for month, then day button by aria-label, then Apply."""
    from datetime import datetime

    try:
        await page.locator("button#date").first.click(timeout=4000)
        await page.wait_for_timeout(600)
        popover = page.locator('[id^="reka-popover-content-"], [role="dialog"]').first
        await popover.wait_for(state="visible", timeout=4000)
        await page.wait_for_timeout(400)

        d = datetime.strptime(date_key, "%Y-%m-%d")
        month_name = d.strftime("%B")
        day_label = d.strftime("%A, %B ") + str(d.day) + ","

        for i in range(2):
            try:
                cb = page.get_by_role("combobox").nth(i)
                await cb.click(timeout=3000)
                await page.wait_for_timeout(400)
                opt = page.get_by_role("option", name=month_name)
                await opt.first.click(timeout=2000)
                await page.wait_for_timeout(300)
            except Exception:
                break

        day_btn = page.get_by_role("button", name=day_label)
        n = await day_btn.count()
        if n >= 1:
            await day_btn.first.click(timeout=2000)
            await page.wait_for_timeout(300)
        if n >= 2:
            await day_btn.nth(1).click(timeout=2000)
            await page.wait_for_timeout(300)

        await page.get_by_role("button", name="Apply").click(timeout=5000)
        await page.wait_for_timeout(500)
        return True
    except Exception as e:
        log(f"  PolicyDen date picker failed: {e}")
        return False


async def scrape_policyden(
    auth_path: Path,
    date_key: str,
    bot_dir: Path,
    policyden_user: str = "",
    policyden_pass: str = "",
) -> dict[str, int]:
    """Return { agent_name: sales_count } via dashboard date picker + Open Live View for the given date_key."""
    from playwright.async_api import async_playwright

    out: dict[str, int] = {}
    if not auth_path.exists():
        log("  auth_policyden.json not found; skipping PolicyDen.")
        return out

    open_btn = SELECTORS_POLICYDEN.get("open_live_view")
    if not open_btn:
        log("  Open Live View selector not configured; skipping PolicyDen.")
        return out

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=str(auth_path))
        page = await context.new_page()
        if stealth_async:
            await stealth_async(page)
        try:
            await page.goto(POLICYDEN_DASHBOARD, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)

            if "/login" in page.url:
                await browser.close()
                if policyden_user and policyden_pass:
                    if await login_and_save_async("policyden", policyden_user, policyden_pass, auth_path, log_fn=log):
                        return await scrape_policyden(auth_path, date_key, bot_dir, policyden_user, policyden_pass)
                log("  PolicyDen: session expired (no credentials in .env for auto re-login).")
                return out

            live_page = page
            try:
                async with context.expect_page(timeout=6000) as popup_info:
                    await page.click(open_btn, timeout=8000)
                live_page = await popup_info.value
                await live_page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                await page.wait_for_timeout(3000)
                live_page = page
            await live_page.wait_for_timeout(2000)

            rows_sel = SELECTORS_POLICYDEN.get("table_rows") or "table tbody tr"
            col_agent = SELECTORS_POLICYDEN.get("col_agent")
            col_sales = SELECTORS_POLICYDEN.get("col_sales")

            rows = await live_page.locator(rows_sel).all()
            for row in rows:
                cells = await row.locator("td").all()
                if not cells:
                    continue
                agent = ""
                sales = 0
                if isinstance(col_agent, int) and 0 <= col_agent < len(cells):
                    agent = (await cells[col_agent].inner_text() or "").strip()
                    if "\n" in agent:
                        agent = agent.split("\n")[0].strip()
                if isinstance(col_sales, int) and 0 <= col_sales < len(cells):
                    try:
                        sales = int((await cells[col_sales].inner_text() or "0").replace(",", ""))
                    except ValueError:
                        pass
                if agent:
                    out[agent] = out.get(agent, 0) + sales
            if live_page != page:
                await live_page.close()
            n_rows = len(rows)
            if n_rows == 0:
                log("  PolicyDen: 0 table rows (Open Live View may have failed or session expired).")
            else:
                log(f"  PolicyDen: {n_rows} table rows, {len(out)} agents with sales.")
        except KeyboardInterrupt:
            log("  PolicyDen scrape interrupted.")
        except Exception as e:
            log(f"  PolicyDen scrape failed: {e}")
        finally:
            try:
                await browser.close()
            except Exception:
                pass
    return out


async def set_wegenerate_date_on_page(page, date_key: str) -> bool:
    """Set WeGenerate dashboard date using codegen flow: Previous/Next page, then day button by name, then Apply."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    try:
        await page.locator("button#date").first.click(timeout=4000)
        await page.wait_for_timeout(600)
        popover = page.locator('[id^="reka-popover-content-"], [role="dialog"]').first
        try:
            await popover.wait_for(state="visible", timeout=4000)
        except Exception:
            pass
        await page.wait_for_timeout(400)

        d = datetime.strptime(date_key, "%Y-%m-%d")
        now = datetime.now(ZoneInfo(ZONE))
        months_diff = (now.year - d.year) * 12 + (now.month - d.month)
        if months_diff != 0:
            prev_btn = page.get_by_role("button", name="Previous page")
            next_btn = page.get_by_role("button", name="Next page")
            for _ in range(abs(months_diff)):
                try:
                    if months_diff > 0:
                        await prev_btn.first.click(timeout=2000)
                    else:
                        await next_btn.first.click(timeout=2000)
                    await page.wait_for_timeout(400)
                except Exception:
                    break

        day_label = d.strftime("%A, %B ") + str(d.day) + ","
        await page.get_by_role("button", name=day_label).click(timeout=2000)
        await page.wait_for_timeout(300)
        await page.get_by_role("button", name="Apply").click(timeout=5000)
        await page.wait_for_timeout(500)
        return True
    except Exception as e:
        log(f"  WeGenerate date picker failed: {e}")
        return False


async def scrape_wegenerate(
    auth_path: Path,
    date_key: str,
    bot_dir: Path,
    wegenerate_user: str = "",
    wegenerate_pass: str = "",
) -> tuple[dict[str, int], dict[str, float], float | None]:
    """Return ( { agent_name: billable_calls }, { agent_name: marketing }, campaign_marketing_amount or None )."""
    import re
    from playwright.async_api import async_playwright

    out: dict[str, int] = {}
    marketing_by_agent: dict[str, float] = {}
    campaign_marketing: float | None = None
    if not auth_path.exists():
        log("  auth_wegenerate.json not found; skipping WeGenerate.")
        return out, marketing_by_agent, campaign_marketing

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=str(auth_path))
        page = await context.new_page()
        if stealth_async:
            await stealth_async(page)
        try:
            await page.goto(WEGENERATE_DASHBOARD, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3500)

            if "/login" in page.url:
                await browser.close()
                if wegenerate_user and wegenerate_pass:
                    if await login_and_save_async("wegenerate", wegenerate_user, wegenerate_pass, auth_path, log_fn=log):
                        return await scrape_wegenerate(auth_path, date_key, bot_dir, wegenerate_user, wegenerate_pass)
                log("  WeGenerate: session expired (no credentials in .env for auto re-login).")
                return out, marketing_by_agent, campaign_marketing

            # Use the dashboard's default date (typically Today) without manipulating the date picker.
            await page.wait_for_timeout(1500)

            rows_sel = SELECTORS_WEGENERATE.get("table_rows") or "table tbody tr"
            col_agent = SELECTORS_WEGENERATE.get("col_agent")
            col_calls = SELECTORS_WEGENERATE.get("col_calls")
            col_marketing = SELECTORS_WEGENERATE.get("col_marketing")

            card_heading = SELECTORS_WEGENERATE.get("card_heading")
            if card_heading:
                try:
                    await page.locator(card_heading).first.scroll_into_view_if_needed(timeout=10000)
                    await page.wait_for_timeout(1200)
                except Exception:
                    pass
            try:
                await page.wait_for_selector(rows_sel, state="attached", timeout=12000)
            except Exception:
                pass
            try:
                await page.locator(rows_sel).first.scroll_into_view_if_needed(timeout=5000)
                await page.wait_for_timeout(400)
            except Exception:
                pass
            try:
                scroll_sel = "div:has(h3:has-text('Agent Performance')) div.overflow-y-auto"
                scroll_container = page.locator(scroll_sel)
                if await scroll_container.count() > 0:
                    for _ in range(8):
                        await scroll_container.first.evaluate("e => { e.scrollTop = e.scrollHeight; }")
                        await page.wait_for_timeout(200)
            except Exception:
                pass
            rows = await page.locator(rows_sel).all()
            if len(rows) == 0 and SELECTORS_WEGENERATE.get("table_rows_fallbacks"):
                for fallback in SELECTORS_WEGENERATE["table_rows_fallbacks"]:
                    rows = await page.locator(fallback).all()
                    if len(rows) > 0:
                        rows_sel = fallback
                        break
            if len(rows) == 0:
                for frame in page.frames:
                    if frame == page.main_frame:
                        continue
                    try:
                        rows = await frame.locator(rows_sel).all()
                        if len(rows) == 0:
                            for fallback in SELECTORS_WEGENERATE.get("table_rows_fallbacks") or []:
                                rows = await frame.locator(fallback).all()
                                if len(rows) > 0:
                                    break
                        if len(rows) > 0:
                            break
                    except Exception:
                        continue
            for row in rows:
                cells = await row.locator("td").all()
                if not cells:
                    continue
                agent = ""
                calls = 0
                marketing_val: float | None = None
                if isinstance(col_agent, int) and 0 <= col_agent < len(cells):
                    agent = (await cells[col_agent].inner_text() or "").strip()
                if isinstance(col_calls, int) and 0 <= col_calls < len(cells):
                    try:
                        calls = int((await cells[col_calls].inner_text() or "0").replace(",", ""))
                    except ValueError:
                        pass
                if isinstance(col_marketing, int) and 0 <= col_marketing < len(cells):
                    text = (await cells[col_marketing].inner_text() or "").strip()
                    if text:
                        match = re.search(r"\$?[\d,]+(?:\.\d{2})?", text)
                        if match:
                            raw = match.group(0).replace("$", "").replace(",", "")
                            try:
                                marketing_val = float(raw)
                            except ValueError:
                                marketing_val = None
                # Fallback: per-agent marketing cell is td.font-bold (e.g. $201.00) in this row
                if marketing_val is None:
                    for cell in cells:
                        cls = await cell.get_attribute("class") or ""
                        if "font-bold" in cls:
                            text = (await cell.inner_text() or "").strip()
                            if text and ("$" in text or re.search(r"[\d,]+(?:\.\d{2})?", text)):
                                match = re.search(r"\$?[\d,]+(?:\.\d{2})?", text)
                                if match:
                                    raw = match.group(0).replace("$", "").replace(",", "")
                                    try:
                                        marketing_val = float(raw)
                                        break
                                    except ValueError:
                                        pass
                if agent:
                    out[agent] = out.get(agent, 0) + calls
                    if marketing_val is not None:
                        marketing_by_agent[agent] = marketing_by_agent.get(agent, 0.0) + marketing_val
            n_rows = len(rows)
            if n_rows == 0:
                log("  WeGenerate: 0 table rows (session may have expired or page structure changed).")
                if os.environ.get("BOT_DEBUG_SCREENSHOT", "").strip().lower() in ("1", "true", "yes"):
                    try:
                        path = bot_dir / "wegenerate_debug.png"
                        await page.screenshot(path=str(path))
                        log(f"  Debug screenshot saved to {path}")
                    except Exception:
                        pass
            else:
                log(f"  WeGenerate: {n_rows} table rows, {len(out)} agents with calls.")

            selectors_to_try = [SELECTORS_WEGENERATE.get("campaign_marketing_cell")] + list(
                SELECTORS_WEGENERATE.get("campaign_marketing_fallbacks") or []
            )
            for sel in selectors_to_try:
                if not sel:
                    continue
                try:
                    cells = await page.locator(sel).all()
                    for cell in cells:
                        text = (await cell.inner_text() or "").strip()
                        if text.startswith("$"):
                            match = re.search(r"\$[\d,]+(?:\.\d{2})?", text)
                            if match:
                                raw = match.group(0).replace("$", "").replace(",", "")
                                try:
                                    campaign_marketing = float(raw)
                                    log(f"  WeGenerate: campaign marketing ${campaign_marketing:,.2f}")
                                    break
                                except ValueError:
                                    pass
                    if campaign_marketing is not None:
                        break
                except Exception:
                    continue
        except KeyboardInterrupt:
            log("  WeGenerate scrape interrupted.")
        except Exception as e:
            log(f"  WeGenerate scrape failed: {e}")
        finally:
            try:
                await browser.close()
            except Exception:
                pass
    return out, marketing_by_agent, campaign_marketing


def api_login(session, base_url: str, username: str, password: str) -> bool:
    r = request_with_retries(
        session,
        "post",
        f"{base_url.rstrip('/')}/auth/login",
        json={"username": username, "password": password},
        timeout=15,
        log_fn=log,
    )
    if r.status_code != 200:
        log(f"  Login failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def api_get_state(session, base_url: str) -> dict | None:
    r = request_with_retries(
        session,
        "get",
        f"{base_url.rstrip('/')}/state",
        timeout=90,
        max_retries=5,
        headers={"Cache-Control": "no-cache", "Pragma": "no-cache"},
        log_fn=log,
    )
    if r.status_code != 200:
        log(f"  GET /state failed: {r.status_code}")
        return None
    data = r.json()
    return data.get("data") if isinstance(data, dict) else data


def api_put_snapshots(session, base_url: str, snapshots: list) -> bool:
    r = request_with_retries(
        session,
        "put",
        f"{base_url.rstrip('/')}/state/snapshots",
        json=snapshots,
        timeout=15,
        log_fn=log,
    )
    if r.status_code != 200:
        log(f"  PUT /state/snapshots failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def api_set_house_marketing(session, base_url: str, date_key: str, amount: float) -> bool:
    r = request_with_retries(
        session,
        "post",
        f"{base_url.rstrip('/')}/state/house-marketing",
        json={"dateKey": date_key, "amount": round(amount, 2)},
        timeout=10,
        log_fn=log,
    )
    if r.status_code != 200:
        log(f"  POST /state/house-marketing failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def send_telegram(text: str) -> bool:
    """Send a message via Telegram Bot API. Returns True if sent, False if skipped or failed."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        return False
    try:
        import requests
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
            timeout=10,
        )
        if r.status_code != 200:
            log(f"  Telegram send failed: {r.status_code} {r.text[:200]}")
            return False
        return True
    except Exception as e:
        log(f"  Telegram send error: {e}")
        return False


def merge_snapshots(
    existing: list,
    new_rows: list,
    date_key: str,
    slot_key: str,
) -> list:
    """Replace existing snapshots for (date_key, slot_key) with new_rows; keep the rest."""
    key = (date_key, slot_key)
    rest = [s for s in existing if (s.get("dateKey"), s.get("slot")) != key]
    return rest + new_rows


async def _run_scrapes_async(
    auth_policyden: Path,
    auth_wegenerate: Path,
    date_key: str,
    bot_dir: Path,
    policyden_user: str,
    policyden_pass: str,
    wegenerate_user: str,
    wegenerate_pass: str,
):
    """Run both scrapers (async)."""
    log("Scraping PolicyDen (sales)...")
    sales = await scrape_policyden(
        auth_policyden, date_key, bot_dir, policyden_user, policyden_pass
    )
    log("Scraping WeGenerate (calls + marketing)...")
    calls, marketing_by_agent, campaign_marketing = await scrape_wegenerate(
        auth_wegenerate, date_key, bot_dir, wegenerate_user, wegenerate_pass
    )
    return sales, calls, marketing_by_agent, campaign_marketing


def main() -> int:
    return asyncio.run(main_async())


async def main_async() -> int:
    load_dotenv()
    bot_dir = Path(__file__).resolve().parent

    api_base = os.environ.get("API_BASE_URL", "").strip()
    if not api_base:
        log("Set API_BASE_URL in .env")
        return 1
    if not api_base.startswith("http://") and not api_base.startswith("https://"):
        api_base = "https://" + api_base
    admin_user = os.environ.get("ADMIN_USERNAME", "").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "").strip()
    if not admin_user or not admin_pass:
        log("Set ADMIN_USERNAME, ADMIN_PASSWORD in .env")
        return 1

    date_key = get_date_key_est()
    slot_key, slot_label = get_current_slot()
    log(f"Date: {date_key}  Slot: {slot_key} ({slot_label})")

    from datetime import datetime
    from zoneinfo import ZoneInfo
    now_est = datetime.now(ZoneInfo(ZONE))
    if now_est.hour < 9:
        log("Outside scraping window (9 AM–9 PM EST, Mon–Fri); skipping.")
        return 0
    if now_est.hour > 21:
        log("Outside scraping window (9 AM–9 PM EST, Mon–Fri); skipping.")
        return 0
    if now_est.weekday() >= 5:
        log("Outside scraping window (9 AM–9 PM EST, Mon–Fri); skipping.")
        return 0

    agent_map = load_agent_map(bot_dir)
    if not agent_map:
        log("No agent_map.json; exiting.")
        return 0

    auth_policyden = bot_dir / "auth_policyden.json"
    auth_wegenerate = bot_dir / "auth_wegenerate.json"

    policyden_user = os.environ.get("POLICYDEN_USERNAME", "").strip()
    policyden_pass = os.environ.get("POLICYDEN_PASSWORD", "").strip()
    wegenerate_user = os.environ.get("WEGENERATE_USERNAME", "").strip()
    wegenerate_pass = os.environ.get("WEGENERATE_PASSWORD", "").strip()

    sales_by_agent, calls_by_agent, marketing_by_agent, campaign_marketing = await _run_scrapes_async(
        auth_policyden,
        auth_wegenerate,
        date_key,
        bot_dir,
        policyden_user,
        policyden_pass,
        wegenerate_user,
        wegenerate_pass,
    )

    if not sales_by_agent and not calls_by_agent:
        log("  Both scrapers empty. Re-run capture.py for both sites, re-upload auth_*.json to the VPS, and try again (sessions expire).")
        msg = (
            "VC Dash bot: PolicyDen and WeGenerate sessions may have expired. "
            "Both scrapers returned no data. Re-run capture.py for both sites and re-upload auth_*.json to the VPS."
        )
        if send_telegram(msg):
            log("  Telegram notification sent.")
    else:
        if not sales_by_agent:
            log("  PolicyDen returned no data (session may have expired).")
            if send_telegram("VC Dash bot: PolicyDen session may have expired. Re-run capture.py policyden and re-upload auth_policyden.json."):
                log("  Telegram notification sent.")
        if not calls_by_agent:
            log("  WeGenerate returned no data (session may have expired).")
            if send_telegram("VC Dash bot: WeGenerate session may have expired. Re-run capture.py wegenerate and re-upload auth_wegenerate.json."):
                log("  Telegram notification sent.")

    verbose = os.environ.get("BOT_VERBOSE", "").strip().lower() in ("1", "true", "yes")
    if verbose:
        log("  [verbose] PolicyDen scraped (name -> sales): " + str(dict(sorted(sales_by_agent.items()))))
        log("  [verbose] WeGenerate scraped (name -> calls): " + str(dict(sorted(calls_by_agent.items()))))
        log("  [verbose] WeGenerate scraped (name -> marketing): " + str(dict(sorted(marketing_by_agent.items()))))
        log("  [verbose] agent_map keys (display names): " + str(list(agent_map.keys())))

    import requests
    session = requests.Session()
    session.headers["Content-Type"] = "application/json"

    try:
        if not api_login(session, api_base, admin_user, admin_pass):
            return 1
        state = api_get_state(session, api_base)
        if not state:
            return 1

        agents = state.get("agents") or []
        active_ids = {a["id"] for a in agents if a.get("active")}
        name_to_id = {a["name"]: a["id"] for a in agents}

        existing_snapshots = state.get("snapshots") or []
        existing_by_key = {(s["dateKey"], s["slot"], s["agentId"]): s for s in existing_snapshots}

        from datetime import datetime, timezone
        from zoneinfo import ZoneInfo
        now_utc = datetime.now(ZoneInfo(ZONE)).astimezone(timezone.utc)
        now_iso = now_utc.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        new_rows = []
        for display_name, agent_id in agent_map.items():
            if agent_id not in active_ids:
                continue
            sales = sales_by_agent.get(display_name, 0)
            calls = calls_by_agent.get(display_name, 0)
            existing = existing_by_key.get((date_key, slot_key, agent_id))
            snap_id = existing["id"] if existing else f"snap_{uuid.uuid4()}"
            # Prefer fresh marketing from WeGenerate; otherwise preserve existing value for this slot if present.
            raw_marketing = marketing_by_agent.get(display_name)
            if isinstance(raw_marketing, (int, float)):
                marketing = float(raw_marketing)
            elif existing and isinstance(existing.get("marketing"), (int, float)):
                marketing = float(existing.get("marketing"))  # type: ignore[arg-type]
            else:
                marketing = None
            new_rows.append({
                "id": snap_id,
                "dateKey": date_key,
                "slot": slot_key,
                "slotLabel": slot_label,
                "agentId": agent_id,
                "billableCalls": calls,
                "sales": sales,
                "marketing": marketing,
                "updatedAt": now_iso,
            })
            if verbose:
                log(
                    f"  [verbose] Row: {display_name!r} -> agentId={agent_id[:8]}... "
                    f"sales={sales} calls={calls} marketing={marketing!r}"
                )

        if not new_rows:
            log("No snapshot rows to push (check agent_map and active agents).")
            return 0

        merged = merge_snapshots(existing_snapshots, new_rows, date_key, slot_key)
        if api_put_snapshots(session, api_base, merged):
            log(f"Pushed {len(new_rows)} snapshots for {date_key} {slot_key}.")
            if campaign_marketing is not None:
                if api_set_house_marketing(session, api_base, date_key, campaign_marketing):
                    log(f"Set house marketing ${campaign_marketing:,.2f} for {date_key}.")
                else:
                    log("  Failed to set house marketing; skipping houseMarketing update for this run.")
            return 0
        return 1
    except (requests.exceptions.ChunkedEncodingError, requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
        log(f"  API connection failed after retries: {e}")
        send_telegram("VC Dash bot: API connection failed after retries (GET state). Dashboard may not update.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
