#!/usr/bin/env python3
"""
VPS intra-day bot: scrape PolicyDen (sales) and WeGenerate (calls), merge into
dashboard snapshots via API. Run every 10 min via cron.

The dashboard Agent Performance card uses the latest snapshot per agent; there is
no manual intra-day entry and no intra-performance alert.

Requires on VPS: .env (API_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD),
auth_policyden.json, auth_wegenerate.json, agent_map.json.
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv

from auth_login import login_and_save

# Optional: reduce detection on datacenter IPs
try:
    from playwright_stealth import stealth_sync
except ImportError:
    stealth_sync = None

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
# PolicyDen: use dashboard + "Open Live View" (auto today's date); live view leaderboard: RANK(0), AGENT(1), SALES(2)
SELECTORS_POLICYDEN = {
    "open_live_view": 'button:has-text("Open Live View")',
    "table_rows": "table tbody tr",
    "col_agent": 1,   # AGENT column (name + email)
    "col_sales": 2,   # SALES column (e.g. 6)
}
# WeGenerate /dashboard: table is inside a card "Agent Performance"; must open date picker, click Today, Apply to load data.
# Campaign Performance: marketing $ in a td with font-bold (e.g. $2,695.00).
SELECTORS_WEGENERATE = {
    "date_trigger": "button#date",
    "date_apply": "button:has-text('Apply')",
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


def set_date_on_page(page, date_key: str, selectors: dict) -> bool:
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
            page.click(trigger_sel, timeout=4000)
            trigger_clicked = True
            break
        except Exception:
            continue
    if not trigger_clicked:
        log("  Date picker: could not open (trigger not found). Scraping page default date.")
        return False
    try:
        # Wait for popover content to appear (reka popover; id can vary)
        page.wait_for_timeout(600)
        popover = page.locator('[id^="reka-popover-content-"], [role="dialog"]').first
        try:
            popover.wait_for(state="visible", timeout=4000)
        except Exception:
            pass
        page.wait_for_timeout(400)
        # Click "Today" *inside* the popover (enables Apply)
        today_selectors = (
            'button:has-text("Today")',
            'button.bg-primary-500:has-text("Today")',
            '[data-slot="button"]:has-text("Today")',
        )
        for today_sel in today_selectors:
            try:
                # Prefer Today inside the popover
                loc = popover.locator(today_sel)
                if loc.count() == 0:
                    loc = page.locator(today_sel)
                loc.wait_for(state="visible", timeout=2000)
                if loc.count() > 0:
                    loc.first.click(timeout=2000)
                    page.wait_for_timeout(600)
                    break
            except Exception:
                continue
        # Otherwise click the day cell so Apply becomes enabled
        day = date_key.split("-")[2].lstrip("0") or "1"  # e.g. "24"
        day_sel = (
            f'[data-date="{date_key}"]',
            f'[data-value="{date_key}"]',
            f'[role="gridcell"]:has-text("{day}")',
            f'button:has-text("{day}")',
            f'[class*="day"]:has-text("^{day}$")',
        )
        clicked_day = False
        for sel in day_sel:
            try:
                loc = page.locator(sel)
                if loc.count() > 0:
                    loc.first.click(timeout=2000)
                    clicked_day = True
                    break
            except Exception:
                continue
        if clicked_day:
            page.wait_for_timeout(400)
        # Wait for Apply to be enabled (it starts disabled until a date is chosen), then click
        apply_loc = page.locator(selectors["date_apply"])
        try:
            apply_loc.wait_for(state="visible", timeout=3000)
            # Poll until enabled (up to 10s)
            for _ in range(50):
                if apply_loc.is_enabled():
                    break
                page.wait_for_timeout(200)
            apply_loc.click(timeout=5000)
        except Exception as e:
            log(f"  Apply button: {e}")
            # Close popover so table is visible for scraping
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            return False
        page.wait_for_timeout(500)
        return True
    except Exception as e:
        log(f"  Date picker failed: {e}")
        return False


def scrape_policyden(
    auth_path: Path,
    date_key: str,
    bot_dir: Path,
    policyden_user: str = "",
    policyden_pass: str = "",
) -> dict[str, int]:
    """Return { agent_name: sales_count } via dashboard -> Open Live View (today's date auto-set)."""
    from playwright.sync_api import sync_playwright

    out: dict[str, int] = {}
    if not auth_path.exists():
        log("  auth_policyden.json not found; skipping PolicyDen.")
        return out

    open_btn = SELECTORS_POLICYDEN.get("open_live_view")
    if not open_btn:
        log("  Open Live View selector not configured; skipping PolicyDen.")
        return out

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=str(auth_path))
        page = context.new_page()
        if stealth_sync:
            stealth_sync(page)
        try:
            page.goto(POLICYDEN_DASHBOARD, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            # Session expired: on login page. Try auto re-login if credentials set.
            if "/login" in page.url:
                browser.close()
                if policyden_user and policyden_pass:
                    if login_and_save("policyden", policyden_user, policyden_pass, auth_path, log_fn=log):
                        return scrape_policyden(auth_path, date_key, bot_dir, policyden_user, policyden_pass)
                log("  PolicyDen: session expired (no credentials in .env for auto re-login).")
                return out

            # Click Open Live View (may open new tab or navigate same page; today's date auto-set)
            live_page = page
            try:
                with context.expect_page(timeout=6000) as popup_info:
                    page.click(open_btn, timeout=8000)
                live_page = popup_info.value
                live_page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                # Same-page navigation or table appears on current page
                page.wait_for_timeout(3000)
                live_page = page
            live_page.wait_for_timeout(2000)

            rows_sel = SELECTORS_POLICYDEN.get("table_rows") or "table tbody tr"
            col_agent = SELECTORS_POLICYDEN.get("col_agent")
            col_sales = SELECTORS_POLICYDEN.get("col_sales")

            rows = live_page.query_selector_all(rows_sel)
            for row in rows:
                cells = row.query_selector_all("td")
                if not cells:
                    continue
                agent = ""
                sales = 0
                if isinstance(col_agent, int) and 0 <= col_agent < len(cells):
                    agent = (cells[col_agent].inner_text() or "").strip()
                    # Live view has "Name\nemail" - take first line
                    if "\n" in agent:
                        agent = agent.split("\n")[0].strip()
                if isinstance(col_sales, int) and 0 <= col_sales < len(cells):
                    try:
                        sales = int((cells[col_sales].inner_text() or "0").replace(",", ""))
                    except ValueError:
                        pass
                if agent:
                    out[agent] = out.get(agent, 0) + sales
            if live_page != page:
                live_page.close()
            n_rows = len(rows)
            if n_rows == 0:
                log("  PolicyDen: 0 table rows (Open Live View may have failed or session expired).")
            else:
                log(f"  PolicyDen: {n_rows} table rows, {len(out)} agents with sales.")
        except Exception as e:
            log(f"  PolicyDen scrape failed: {e}")
        finally:
            browser.close()
    return out


def scrape_wegenerate(
    auth_path: Path,
    date_key: str,
    bot_dir: Path,
    wegenerate_user: str = "",
    wegenerate_pass: str = "",
) -> tuple[dict[str, int], float | None]:
    """Return ( { agent_name: billable_calls }, campaign_marketing_amount or None )."""
    from playwright.sync_api import sync_playwright
    import re

    out: dict[str, int] = {}
    campaign_marketing: float | None = None
    if not auth_path.exists():
        log("  auth_wegenerate.json not found; skipping WeGenerate.")
        return out, campaign_marketing

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=str(auth_path))
        page = context.new_page()
        if stealth_sync:
            stealth_sync(page)
        try:
            page.goto(WEGENERATE_DASHBOARD, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3500)

            # Session expired: on login page. Try auto re-login if credentials set.
            if "/login" in page.url:
                browser.close()
                if wegenerate_user and wegenerate_pass:
                    if login_and_save("wegenerate", wegenerate_user, wegenerate_pass, auth_path, log_fn=log):
                        return scrape_wegenerate(auth_path, date_key, bot_dir, wegenerate_user, wegenerate_pass)
                log("  WeGenerate: session expired (no credentials in .env for auto re-login).")
                return out, campaign_marketing

            if SELECTORS_WEGENERATE.get("date_trigger") and SELECTORS_WEGENERATE.get("date_apply"):
                set_date_on_page(page, date_key, SELECTORS_WEGENERATE)
                page.wait_for_timeout(1500)

            rows_sel = SELECTORS_WEGENERATE.get("table_rows") or "table tbody tr"
            col_agent = SELECTORS_WEGENERATE.get("col_agent")
            col_calls = SELECTORS_WEGENERATE.get("col_calls")

            card_heading = SELECTORS_WEGENERATE.get("card_heading")
            if card_heading:
                try:
                    page.locator(card_heading).first.scroll_into_view_if_needed(timeout=10000)
                    page.wait_for_timeout(1200)
                except Exception:
                    pass
            try:
                page.wait_for_selector(rows_sel, state="attached", timeout=12000)
            except Exception:
                pass
            try:
                page.locator(rows_sel).first.scroll_into_view_if_needed(timeout=5000)
                page.wait_for_timeout(400)
            except Exception:
                pass
            try:
                scroll_sel = "div:has(h3:has-text('Agent Performance')) div.overflow-y-auto"
                scroll_container = page.locator(scroll_sel)
                if scroll_container.count() > 0:
                    for _ in range(8):
                        scroll_container.first.evaluate("e => { e.scrollTop = e.scrollHeight; }")
                        page.wait_for_timeout(200)
            except Exception:
                pass
            rows = page.query_selector_all(rows_sel)
            if len(rows) == 0 and SELECTORS_WEGENERATE.get("table_rows_fallbacks"):
                for fallback in SELECTORS_WEGENERATE["table_rows_fallbacks"]:
                    rows = page.query_selector_all(fallback)
                    if len(rows) > 0:
                        rows_sel = fallback
                        break
            if len(rows) == 0:
                for frame in page.frames:
                    if frame == page.main_frame:
                        continue
                    try:
                        rows = frame.query_selector_all(rows_sel)
                        if len(rows) == 0:
                            for fallback in SELECTORS_WEGENERATE.get("table_rows_fallbacks") or []:
                                rows = frame.query_selector_all(fallback)
                                if len(rows) > 0:
                                    break
                        if len(rows) > 0:
                            break
                    except Exception:
                        continue
            for row in rows:
                cells = row.query_selector_all("td")
                if not cells:
                    continue
                agent = ""
                calls = 0
                if isinstance(col_agent, int) and 0 <= col_agent < len(cells):
                    agent = (cells[col_agent].inner_text() or "").strip()
                if isinstance(col_calls, int) and 0 <= col_calls < len(cells):
                    try:
                        calls = int((cells[col_calls].inner_text() or "0").replace(",", ""))
                    except ValueError:
                        pass
                if agent:
                    out[agent] = out.get(agent, 0) + calls
            n_rows = len(rows)
            if n_rows == 0:
                log("  WeGenerate: 0 table rows (session may have expired or page structure changed).")
                if os.environ.get("BOT_DEBUG_SCREENSHOT", "").strip().lower() in ("1", "true", "yes"):
                    try:
                        path = bot_dir / "wegenerate_debug.png"
                        page.screenshot(path=str(path))
                        log(f"  Debug screenshot saved to {path}")
                    except Exception:
                        pass
            else:
                log(f"  WeGenerate: {n_rows} table rows, {len(out)} agents with calls.")

            # Campaign Performance table: scrape marketing $ (e.g. $2,695.00) for house pulse CPA.
            selectors_to_try = [SELECTORS_WEGENERATE.get("campaign_marketing_cell")] + list(
                SELECTORS_WEGENERATE.get("campaign_marketing_fallbacks") or []
            )
            for sel in selectors_to_try:
                if not sel:
                    continue
                try:
                    cells = page.query_selector_all(sel)
                    for cell in cells:
                        text = (cell.inner_text() or "").strip()
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
        except Exception as e:
            log(f"  WeGenerate scrape failed: {e}")
        finally:
            browser.close()
    return out, campaign_marketing


def api_login(session, base_url: str, username: str, password: str) -> bool:
    r = session.post(
        f"{base_url.rstrip('/')}/auth/login",
        json={"username": username, "password": password},
        timeout=15,
    )
    if r.status_code != 200:
        log(f"  Login failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def api_get_state(session, base_url: str) -> dict | None:
    r = session.get(
        f"{base_url.rstrip('/')}/state",
        timeout=15,
        headers={"Cache-Control": "no-cache", "Pragma": "no-cache"},
    )
    if r.status_code != 200:
        log(f"  GET /state failed: {r.status_code}")
        return None
    data = r.json()
    return data.get("data") if isinstance(data, dict) else data


def api_put_snapshots(session, base_url: str, snapshots: list) -> bool:
    r = session.put(
        f"{base_url.rstrip('/')}/state/snapshots",
        json=snapshots,
        timeout=15,
    )
    if r.status_code != 200:
        log(f"  PUT /state/snapshots failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def api_set_house_marketing(session, base_url: str, date_key: str, amount: float) -> bool:
    r = session.post(
        f"{base_url.rstrip('/')}/state/house-marketing",
        json={"dateKey": date_key, "amount": round(amount, 2)},
        timeout=10,
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


def _run_scrapes(
    auth_policyden: Path,
    auth_wegenerate: Path,
    date_key: str,
    bot_dir: Path,
    policyden_user: str,
    policyden_pass: str,
    wegenerate_user: str,
    wegenerate_pass: str,
):
    """Run both scrapers in one thread (avoids Playwright sync API / asyncio loop conflict)."""
    log("Scraping PolicyDen (sales)...")
    sales = scrape_policyden(
        auth_policyden, date_key, bot_dir, policyden_user, policyden_pass
    )
    log("Scraping WeGenerate (calls)...")
    calls, marketing = scrape_wegenerate(
        auth_wegenerate, date_key, bot_dir, wegenerate_user, wegenerate_pass
    )
    return sales, calls, marketing


def main() -> int:
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
        log("Outside scraping window (9 AM–midnight EST); skipping.")
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

    with ThreadPoolExecutor(max_workers=1) as ex:
        sales_by_agent, calls_by_agent, campaign_marketing = ex.submit(
            _run_scrapes,
            auth_policyden,
            auth_wegenerate,
            date_key,
            bot_dir,
            policyden_user,
            policyden_pass,
            wegenerate_user,
            wegenerate_pass,
        ).result()

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
        log("  [verbose] agent_map keys (display names): " + str(list(agent_map.keys())))

    import requests
    session = requests.Session()
    session.headers["Content-Type"] = "application/json"

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
        new_rows.append({
            "id": snap_id,
            "dateKey": date_key,
            "slot": slot_key,
            "slotLabel": slot_label,
            "agentId": agent_id,
            "billableCalls": calls,
            "sales": sales,
            "updatedAt": now_iso,
        })
        if verbose:
            log(f"  [verbose] Row: {display_name!r} -> agentId={agent_id[:8]}... sales={sales} calls={calls}")

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
                log("  Failed to set house marketing; house pulse CPA will use calls*15 until next run.")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
