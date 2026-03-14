#!/usr/bin/env python3
"""
Self-contained backfill bot: PolicyDen + WeGenerate via Playwright, headed by default
so you can watch the process. No imports from main.py, auth_login.py, or backfill.py.

Usage:
  python backfill_headed.py --start 2025-03-01 --end 2025-03-07
  python backfill_headed.py --start 2025-03-01 --end 2025-03-07 --slow-mo 500 --trace ./traces
  python backfill_headed.py --start 2025-03-01 --end 2025-03-07 --freeze

Requires: .env (API_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, POLICYDEN_USERNAME, POLICYDEN_PASSWORD,
         WEGENERATE_USERNAME, WEGENERATE_PASSWORD), agent_map.json. Auth JSON files optional (will login and save).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from playwright.async_api import async_playwright

# --- Constants ---
ZONE = "America/New_York"
POLICYDEN_LOGIN = "https://app.policyden.com/login"
POLICYDEN_DASHBOARD = "https://app.policyden.com/dashboard"
WEGENERATE_LOGIN = "https://app.wegenerate.com/login"
WEGENERATE_DASHBOARD = "https://app.wegenerate.com/dashboard"
SLOT_KEY_DEFAULT = "17:00"
SLOT_LABEL_DEFAULT = "5:00 PM"


def log(msg: str) -> None:
    print(msg, flush=True)


# --- HTTP with retries (inlined, no http_retry import) ---
def request_with_retries(
    session: requests.Session,
    method: str,
    url: str,
    *,
    max_retries: int = 5,
    **kwargs,
) -> requests.Response:
    last_exc = None
    for attempt in range(max_retries):
        try:
            r = session.request(method, url, **kwargs)
            _ = r.content
            return r
        except (
            requests.exceptions.ChunkedEncodingError,
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
        ) as e:
            last_exc = e
            log(f"  Request failed (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 + 2**attempt)
    raise last_exc or RuntimeError("request_with_retries: no attempt ran")


# --- Config / env ---
def load_agent_map(bot_dir: Path) -> dict[str, str]:
    path = bot_dir / "agent_map.json"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def get_env() -> tuple[str, str, str, str, str, str, str]:
    load_dotenv()
    api_base = (os.environ.get("API_BASE_URL") or "").strip()
    if not api_base.startswith("http"):
        api_base = "https://" + api_base if api_base else ""
    admin_user = (os.environ.get("ADMIN_USERNAME") or "").strip()
    admin_pass = (os.environ.get("ADMIN_PASSWORD") or "").strip()
    policyden_user = (os.environ.get("POLICYDEN_USERNAME") or "").strip()
    policyden_pass = (os.environ.get("POLICYDEN_PASSWORD") or "").strip()
    wegenerate_user = (os.environ.get("WEGENERATE_USERNAME") or "").strip()
    wegenerate_pass = (os.environ.get("WEGENERATE_PASSWORD") or "").strip()
    return api_base, admin_user, admin_pass, policyden_user, policyden_pass, wegenerate_user, wegenerate_pass


# --- API (inlined) ---
def api_login(session: requests.Session, base_url: str, username: str, password: str) -> bool:
    url = f"{base_url.rstrip('/')}/auth/login"
    r = request_with_retries(session, "post", url, json={"username": username, "password": password}, timeout=15)
    if r.status_code != 200:
        log(f"  Login failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def api_get_state(session: requests.Session, base_url: str) -> dict | None:
    url = f"{base_url.rstrip('/')}/state"
    r = request_with_retries(
        session, "get", url, timeout=90, max_retries=5,
        headers={"Cache-Control": "no-cache", "Pragma": "no-cache"},
    )
    if r.status_code != 200:
        log(f"  GET /state failed: {r.status_code}")
        return None
    data = r.json()
    return data.get("data") if isinstance(data, dict) else data


def api_put_snapshots(session: requests.Session, base_url: str, snapshots: list) -> bool:
    url = f"{base_url.rstrip('/')}/state/snapshots"
    r = request_with_retries(session, "put", url, json=snapshots, timeout=15)
    if r.status_code != 200:
        log(f"  PUT /state/snapshots failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def api_set_house_marketing(session: requests.Session, base_url: str, date_key: str, amount: float) -> bool:
    url = f"{base_url.rstrip('/')}/state/house-marketing"
    r = request_with_retries(session, "post", url, json={"dateKey": date_key, "amount": round(amount, 2)}, timeout=10)
    if r.status_code != 200:
        log(f"  POST /state/house-marketing failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def api_put_perf_history(session: requests.Session, base_url: str, perf_history: list) -> bool:
    url = f"{base_url.rstrip('/')}/state/perfHistory"
    r = request_with_retries(session, "put", url, json=perf_history, timeout=15)
    if r.status_code != 200:
        log(f"  PUT /state/perfHistory failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def merge_snapshots(existing: list, new_rows: list, date_key: str, slot_key: str) -> list:
    key = (date_key, slot_key)
    rest = [s for s in existing if (s.get("dateKey"), s.get("slot")) != key]
    return rest + new_rows


def delete_weekend_dates_in_range(
    session: requests.Session,
    api_base: str,
    snapshots: list,
    perf_history: list,
    start_date: date,
    end_date: date,
    dry_run: bool,
) -> tuple[list, list]:
    """Remove snapshots and perfHistory for weekend dates in [start_date, end_date]. Returns (filtered_snapshots, filtered_perf_history)."""
    weekend_dates = set()
    cur = start_date
    while cur <= end_date:
        if cur.weekday() >= 5:
            weekend_dates.add(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
    if not weekend_dates:
        return snapshots, perf_history
    filtered_snapshots = [s for s in snapshots if not (s.get("dateKey") in weekend_dates)]
    filtered_perf = [p for p in perf_history if not (p.get("dateKey") in weekend_dates)]
    removed_snaps = len(snapshots) - len(filtered_snapshots)
    removed_perf = len(perf_history) - len(filtered_perf)
    log(f"  delete-weekends: {len(weekend_dates)} weekend dates in range: {sorted(weekend_dates)[:5]}{'...' if len(weekend_dates) > 5 else ''}")
    if dry_run:
        log(f"  delete-weekends: [dry-run] would remove {removed_snaps} snapshots, {removed_perf} perfHistory rows")
        return snapshots, perf_history
    if removed_snaps > 0 and not api_put_snapshots(session, api_base, filtered_snapshots):
        log("  delete-weekends: failed to PUT snapshots")
        return snapshots, perf_history
    if removed_perf > 0 and not api_put_perf_history(session, api_base, filtered_perf):
        log("  delete-weekends: failed to PUT perfHistory")
        return snapshots, perf_history
    if removed_snaps > 0 or removed_perf > 0:
        log(f"  delete-weekends: removed {removed_snaps} snapshots, {removed_perf} perfHistory rows")
    return filtered_snapshots, filtered_perf


# --- Login helper (inlined, no auth_login import) ---
async def login_and_save_async(
    page,
    context,
    login_url: str,
    username: str,
    password: str,
    auth_path: Path,
) -> bool:
    try:
        await page.goto(login_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)
        await page.fill("input[type='email'], input[name='email'], input[name='username']", username)
        await page.wait_for_timeout(300)
        await page.fill("input[type='password'], input[name='password']", password)
        await page.wait_for_timeout(300)
        await page.click("button[type='submit'], button:has-text('Log in'), button:has-text('Sign in')")
        for _ in range(30):
            await page.wait_for_timeout(500)
            if "/login" not in page.url:
                break
        await page.wait_for_timeout(2000)
        if "/login" in page.url:
            log("  Still on login page after submit (bad credentials or 2FA?).")
            return False
        auth_path.parent.mkdir(parents=True, exist_ok=True)
        await context.storage_state(path=str(auth_path))
        log(f"  Logged in and saved session to {auth_path.name}")
        return True
    except Exception as e:
        log(f"  Login failed: {e}")
        return False


# --- PolicyDen date picker: dashboard calendar only (no Live View) ---
# Flow: click calendar -> go back to required month -> select date -> click date twice -> Apply
async def set_policyden_date(page, date_key: str) -> bool:
    from zoneinfo import ZoneInfo
    try:
        # Click calendar to open picker
        await page.locator("button#date").first.click(timeout=4000)
        await page.wait_for_timeout(600)
        popover = page.locator('[id^="reka-popover-content-"], [role="dialog"]').first
        await popover.wait_for(state="visible", timeout=4000)
        await page.wait_for_timeout(400)
        d = datetime.strptime(date_key, "%Y-%m-%d")
        now = datetime.now(ZoneInfo(ZONE))
        months_diff = (now.year - d.year) * 12 + (now.month - d.month)
        # Go back (or forward) to the required month
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
        # Select date: day button by label (e.g. "Tuesday, March 10,"), click it twice, then Apply
        day_label = d.strftime("%A, %B ") + str(d.day) + ","
        day_btn = page.get_by_role("button", name=day_label)
        n = await day_btn.count()
        if n >= 1:
            loc = day_btn.first
            await loc.click(timeout=2000)
            await page.wait_for_timeout(300)
            await loc.click(timeout=2000)
            await page.wait_for_timeout(300)
        # Wait for Apply to be enabled, then click
        apply_btn = page.get_by_role("button", name="Apply")
        for _ in range(50):
            if await apply_btn.is_enabled():
                break
            await page.wait_for_timeout(200)
        await apply_btn.click(timeout=10000)
        await page.wait_for_timeout(1000)
        return True
    except Exception as e:
        log(f"  PolicyDen date picker failed: {e}")
        return False


# --- WeGenerate date picker ---
async def set_wegenerate_date(page, date_key: str) -> bool:
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
        # Select date: click day button (e.g. "Monday, January 5,") twice then Apply (same pattern as PolicyDen)
        day_label = d.strftime("%A, %B ") + str(d.day) + ","
        day_btn = page.get_by_role("button", name=day_label)
        n = await day_btn.count()
        if n >= 1:
            loc = day_btn.first
            await loc.click(timeout=2000)
            await page.wait_for_timeout(300)
            await loc.click(timeout=2000)
            await page.wait_for_timeout(300)
        # Wait for Apply to be enabled before clicking (date must be selected first)
        apply_btn = page.get_by_role("button", name="Apply")
        for _ in range(75):
            if await apply_btn.is_enabled():
                break
            await page.wait_for_timeout(200)
        await apply_btn.click(timeout=10000)
        await page.wait_for_timeout(500)
        return True
    except Exception as e:
        log(f"  WeGenerate date picker failed: {e}")
        return False


# --- Scrape PolicyDen for one date ---
async def scrape_policyden(
    page,
    context,
    date_key: str,
    auth_path: Path,
    username: str,
    password: str,
) -> dict[str, int]:
    out: dict[str, int] = {}
    if auth_path.exists():
        try:
            await context.storage_state(path=str(auth_path))
        except Exception:
            pass
    await page.goto(POLICYDEN_DASHBOARD, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(2000)
    if "/login" in page.url:
        if not username or not password:
            log("  PolicyDen: session expired and no credentials in .env")
            return out
        if not await login_and_save_async(page, context, POLICYDEN_LOGIN, username, password, auth_path):
            return out
        await page.goto(POLICYDEN_DASHBOARD, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)
    log(f"  PolicyDen: setting date to {date_key}")
    await set_policyden_date(page, date_key)
    await page.wait_for_timeout(2000)
    # Scrape from dashboard table only (no Live View)
    rows = await page.locator("table tbody tr").all()
    col_agent, col_sales = 1, 2
    for row in rows:
        cells = await row.locator("td").all()
        if not cells:
            continue
        agent = ""
        sales = 0
        if 0 <= col_agent < len(cells):
            agent = (await cells[col_agent].inner_text() or "").strip()
            if "\n" in agent:
                agent = agent.split("\n")[0].strip()
        if 0 <= col_sales < len(cells):
            try:
                sales = int((await cells[col_sales].inner_text() or "0").replace(",", ""))
            except ValueError:
                pass
        if agent:
            out[agent] = out.get(agent, 0) + sales
    log(f"  PolicyDen: {len(rows)} rows, {len(out)} agents with sales")
    return out


async def _stop_trace(context, trace_dir: str | None, suffix: str) -> None:
    if trace_dir:
        path = Path(trace_dir) / f"trace_{suffix}.zip"
        try:
            await context.tracing.stop(path=str(path))
        except Exception as e:
            log(f"  Trace save failed: {e}")


# --- Scrape WeGenerate for one date ---
async def scrape_wegenerate(
    page,
    context,
    date_key: str,
    auth_path: Path,
    username: str,
    password: str,
) -> tuple[dict[str, int], dict[str, float], float | None]:
    out_calls: dict[str, int] = {}
    marketing_by_agent: dict[str, float] = {}
    campaign_marketing: float | None = None
    if auth_path.exists():
        try:
            await context.storage_state(path=str(auth_path))
        except Exception:
            pass
    await page.goto(WEGENERATE_DASHBOARD, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(3500)
    if "/login" in page.url:
        if not username or not password:
            log("  WeGenerate: session expired and no credentials in .env")
            return out_calls, marketing_by_agent, campaign_marketing
        if not await login_and_save_async(page, context, WEGENERATE_LOGIN, username, password, auth_path):
            return out_calls, marketing_by_agent, campaign_marketing
        await page.goto(WEGENERATE_DASHBOARD, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3500)
    log(f"  WeGenerate: setting date to {date_key}")
    await set_wegenerate_date(page, date_key)
    # Wait for table to load after date change (WeGenerate refetches data; 2s was often too short)
    await page.wait_for_timeout(5000)
    table_scope = "div:has(h3:has-text('Agent Performance'))"
    rows_sel = f"{table_scope} table tbody tr"
    try:
        await page.locator("h3:has-text('Agent Performance')").first.scroll_into_view_if_needed(timeout=10000)
        await page.wait_for_timeout(1200)
    except Exception:
        pass
    try:
        scroll_sel = f"{table_scope} div.overflow-y-auto"
        scroll_container = page.locator(scroll_sel)
        if await scroll_container.count() > 0:
            for _ in range(8):
                await scroll_container.first.evaluate("e => { e.scrollTop = e.scrollHeight; }")
                await page.wait_for_timeout(200)
    except Exception:
        pass
    fallbacks = [f"{table_scope} table tbody tr", "table tbody tr", "table tr"]
    rows = await page.locator(rows_sel).all()
    if len(rows) == 0:
        for fb in fallbacks:
            rows = await page.locator(fb).all()
            if len(rows) > 0:
                break
    col_agent, col_calls, col_marketing = 1, 2, 4
    try:
        header_row = page.locator(f"{table_scope} table thead tr").first
        if await header_row.count() > 0:
            headers = await header_row.locator("th").all()
            if not headers:
                headers = await header_row.locator("td").all()
            found_agent = found_calls = found_marketing = False
            for i, th in enumerate(headers):
                text = (await th.inner_text() or "").strip().lower()
                if not found_agent and "agent" in text:
                    col_agent = i
                    found_agent = True
                if not found_calls and "billable" in text:
                    col_calls = i
                    found_calls = True
                if not found_marketing and "marketing" in text and "campaign" not in text and "cpa" not in text:
                    col_marketing = i
                    found_marketing = True
        log(f"  WeGenerate: columns Agent={col_agent}, Billable={col_calls}, Marketing={col_marketing}")
    except Exception as e:
        log(f"  WeGenerate: header detection failed ({e}), using default columns")
    for row in rows:
        cells = await row.locator("td").all()
        if len(cells) < 3:
            continue
        agent = (await cells[col_agent].inner_text() or "").strip() if 0 <= col_agent < len(cells) else ""
        if not agent or agent.lower() in ("agent", "name", "rank"):
            continue
        calls = 0
        marketing_val = None
        if 0 <= col_calls < len(cells):
            raw_calls = (await cells[col_calls].inner_text() or "").strip().replace(",", "")
            if raw_calls.isdigit():
                calls = int(raw_calls)
        if 0 <= col_marketing < len(cells):
            text = (await cells[col_marketing].inner_text() or "").strip()
            if text:
                m = re.search(r"\$?[\d,]+(?:\.\d{2})?", text)
                if m:
                    try:
                        marketing_val = float(m.group(0).replace("$", "").replace(",", ""))
                    except ValueError:
                        pass
        if marketing_val is None:
            # Fallback: use bold cell only from marketing column or columns after it (avoid picking Sales column)
            for i, cell in enumerate(cells):
                if i < col_marketing:
                    continue
                cls = await cell.get_attribute("class") or ""
                if "font-bold" not in cls:
                    continue
                text = (await cell.inner_text() or "").strip()
                if text and ("$" in text or re.search(r"[\d,]+(?:\.\d{2})?", text)):
                    m = re.search(r"\$?[\d,]+(?:\.\d{2})?", text)
                    if m:
                        try:
                            marketing_val = float(m.group(0).replace("$", "").replace(",", ""))
                            break
                        except ValueError:
                            pass
        if agent:
            out_calls[agent] = out_calls.get(agent, 0) + calls
            if marketing_val is not None:
                marketing_by_agent[agent] = marketing_by_agent.get(agent, 0.0) + marketing_val
    for sel in ["td.font-bold", "td[class*='font-bold']"]:
        try:
            for cell in await page.locator(sel).all():
                text = (await cell.inner_text() or "").strip()
                if text.startswith("$"):
                    m = re.search(r"\$[\d,]+(?:\.\d{2})?", text)
                    if m:
                        try:
                            campaign_marketing = float(m.group(0).replace("$", "").replace(",", ""))
                            log(f"  WeGenerate: campaign marketing ${campaign_marketing:,.2f}")
                            break
                        except ValueError:
                            pass
            if campaign_marketing is not None:
                break
        except Exception:
            continue
    log(f"  WeGenerate: {len(rows)} rows, {len(out_calls)} agents with calls")
    return out_calls, marketing_by_agent, campaign_marketing


# --- Build snapshot rows and push ---
def build_snapshot_rows(
    date_key: str,
    slot_key: str,
    slot_label: str,
    agent_map: dict[str, str],
    active_ids: set[str],
    existing_snapshots: list,
    sales_by_agent: dict[str, int],
    calls_by_agent: dict[str, int],
    marketing_by_agent: dict[str, float],
) -> list:
    existing_by_key = {(s.get("dateKey"), s.get("slot"), s.get("agentId")): s for s in existing_snapshots}
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    new_rows = []
    for display_name, agent_id in agent_map.items():
        if agent_id not in active_ids:
            continue
        sales = int(sales_by_agent.get(display_name, 0) or 0)
        calls = int(calls_by_agent.get(display_name, 0) or 0)
        existing = existing_by_key.get((date_key, slot_key, agent_id))
        if display_name in marketing_by_agent:
            marketing_val = float(marketing_by_agent[display_name])
        elif existing and isinstance(existing.get("marketing"), (int, float)):
            marketing_val = float(existing["marketing"])
        else:
            marketing_val = None
        snap_id = existing["id"] if existing and existing.get("id") else f"snap_{uuid.uuid4()}"
        new_rows.append({
            "id": snap_id,
            "dateKey": date_key,
            "slot": slot_key,
            "slotLabel": slot_label,
            "agentId": agent_id,
            "billableCalls": calls,
            "sales": sales,
            "marketing": marketing_val,
            "updatedAt": now_iso,
        })
    return new_rows


def run_freeze(start_key: str, end_key: str, bot_dir: Path) -> int:
    script = bot_dir / "eod.py"
    if not script.exists():
        log(f"  eod.py not found at {script}; skipping --freeze.")
        return 1
    cmd = [sys.executable, str(script), "--backfill-range", start_key, end_key]
    log(f"  Running: {' '.join(cmd)}")
    try:
        return subprocess.run(cmd, check=False).returncode
    except Exception as e:
        log(f"  Error running eod: {e}")
        return 1


# --- Main backfill loop ---
async def run_backfill(
    start_date: date,
    end_date: date,
    slot_key: str,
    slot_label: str,
    bot_dir: Path,
    auth_policyden: Path,
    auth_wegenerate: Path,
    api_base: str,
    admin_user: str,
    admin_pass: str,
    policyden_user: str,
    policyden_pass: str,
    wegenerate_user: str,
    wegenerate_pass: str,
    agent_map: dict[str, str],
    headed: bool = True,
    slow_mo: int | None = None,
    trace_dir: str | None = None,
    video_dir: str | None = None,
    dry_run: bool = False,
    freeze: bool = False,
    skip_weekends: bool = True,
    delete_weekends: bool = False,
) -> int:
    session = requests.Session()
    session.headers["Content-Type"] = "application/json"
    if not api_login(session, api_base, admin_user, admin_pass):
        return 1
    state = api_get_state(session, api_base)
    if not state:
        return 1
    agents = state.get("agents") or []
    active_ids = {a["id"] for a in agents if a.get("active")}
    snapshots = list(state.get("snapshots") or [])
    perf_history = list(state.get("perfHistory") or [])
    start_key = start_date.strftime("%Y-%m-%d")
    if delete_weekends:
        log("Delete weekend dates in range...")
        snapshots, perf_history = delete_weekend_dates_in_range(
            session, api_base, snapshots, perf_history, start_date, end_date, dry_run
        )
    end_key = end_date.strftime("%Y-%m-%d")

    launch_options = {"headless": not headed}
    if slow_mo is not None:
        launch_options["slow_mo"] = slow_mo

    async with async_playwright() as p:
        browser = await p.chromium.launch(**launch_options)
        current = start_date
        while current <= end_date:
            if skip_weekends and current.weekday() >= 5:  # 5=Saturday, 6=Sunday
                log(f"\n=== {current.strftime('%Y-%m-%d')} (weekend, skipping) ===")
                current += timedelta(days=1)
                continue
            date_key = current.strftime("%Y-%m-%d")
            log(f"\n=== {date_key} ===")
            ctx_opts = {}
            if video_dir:
                ctx_opts["record_video_dir"] = video_dir
            context = await browser.new_context(**ctx_opts)
            if trace_dir:
                await context.tracing.start(screenshots=True, snapshots=True)
            page = await context.new_page()
            if auth_policyden.exists():
                try:
                    await context.storage_state(path=str(auth_policyden))
                except Exception:
                    pass
            log("  PolicyDen: opening dashboard...")
            sales_by_agent = await scrape_policyden(
                page, context, date_key, auth_policyden, policyden_user, policyden_pass
            )
            await _stop_trace(context, trace_dir, f"{date_key}_policyden")
            await context.close()
            context = await browser.new_context(**ctx_opts)
            if trace_dir:
                await context.tracing.start(screenshots=True, snapshots=True)
            page = await context.new_page()
            if auth_wegenerate.exists():
                try:
                    await context.storage_state(path=str(auth_wegenerate))
                except Exception:
                    pass
            log("  WeGenerate: opening dashboard...")
            calls_by_agent, marketing_by_agent, campaign_marketing = await scrape_wegenerate(
                page, context, date_key, auth_wegenerate, wegenerate_user, wegenerate_pass
            )
            await _stop_trace(context, trace_dir, f"{date_key}_wegenerate")
            await context.close()

            new_rows = build_snapshot_rows(
                date_key, slot_key, slot_label, agent_map, active_ids, snapshots,
                sales_by_agent, calls_by_agent, marketing_by_agent,
            )
            if not new_rows:
                log(f"  {date_key}: no snapshot rows (check agent_map and active agents).")
                current += timedelta(days=1)
                continue
            merged = merge_snapshots(snapshots, new_rows, date_key, slot_key)
            snapshots = merged
            if dry_run:
                log(f"  [dry-run] Would push {len(new_rows)} snapshots for {date_key}")
                if campaign_marketing is not None:
                    log(f"  [dry-run] Would set house marketing ${campaign_marketing:,.2f}")
            else:
                if api_put_snapshots(session, api_base, merged):
                    log(f"  Pushed {len(new_rows)} snapshots for {date_key} {slot_key}.")
                    if campaign_marketing is not None:
                        if api_set_house_marketing(session, api_base, date_key, campaign_marketing):
                            log(f"  Set house marketing ${campaign_marketing:,.2f} for {date_key}.")
                else:
                    log(f"  Failed to PUT snapshots for {date_key}; stopping.")
                    await browser.close()
                    return 1
            current += timedelta(days=1)
        await browser.close()

    if freeze and not dry_run:
        return run_freeze(start_key, end_key, bot_dir)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Watch backfill: PolicyDen + WeGenerate (headed by default).")
    parser.add_argument("--start", required=True, help="Start date YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="End date YYYY-MM-DD (inclusive)")
    parser.add_argument("--slot", default=SLOT_KEY_DEFAULT, help=f"Slot key (default: {SLOT_KEY_DEFAULT})")
    parser.add_argument("--headed", action="store_true", default=True, help="Run browser visible (default)")
    parser.add_argument("--no-headed", action="store_false", dest="headed", help="Run headless")
    parser.add_argument("--slow-mo", type=int, default=None, metavar="MS", help="Slow down actions by MS milliseconds")
    parser.add_argument("--trace", type=str, default=None, metavar="DIR", help="Save trace to DIR")
    parser.add_argument("--video", type=str, default=None, metavar="DIR", help="Save video to DIR")
    parser.add_argument("--dry-run", action="store_true", help="Scrape only; do not PUT/POST")
    parser.add_argument("--freeze", action="store_true", help="Run eod.py --backfill-range after snapshots (same as backfill.py --freeze)")
    parser.add_argument("--skip-weekends", action="store_true", default=True, help="Skip Saturday and Sunday (default)")
    parser.add_argument("--no-skip-weekends", action="store_false", dest="skip_weekends", help="Include weekends")
    parser.add_argument("--delete-weekends", action="store_true", help="Remove existing snapshots and perfHistory for weekend dates in the range")
    args = parser.parse_args()
    try:
        start_date = datetime.strptime(args.start.strip(), "%Y-%m-%d").date()
        end_date = datetime.strptime(args.end.strip(), "%Y-%m-%d").date()
    except ValueError:
        log("Invalid --start or --end; use YYYY-MM-DD")
        return 1
    if end_date < start_date:
        log("--end must be >= --start")
        return 1
    slot_key = args.slot.strip()
    slot_label = SLOT_LABEL_DEFAULT if slot_key == SLOT_KEY_DEFAULT else f"{slot_key} slot"
    api_base, admin_user, admin_pass, policyden_user, policyden_pass, wegenerate_user, wegenerate_pass = get_env()
    if not api_base or not admin_user or not admin_pass:
        log("Set API_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD in .env")
        return 1
    bot_dir = Path(__file__).resolve().parent
    agent_map = load_agent_map(bot_dir)
    if not agent_map:
        log("No agent_map.json in bot dir; exiting.")
        return 1
    auth_policyden = bot_dir / "auth_policyden.json"
    auth_wegenerate = bot_dir / "auth_wegenerate.json"
    return asyncio.run(run_backfill(
        start_date, end_date, slot_key, slot_label, bot_dir,
        auth_policyden, auth_wegenerate,
        api_base, admin_user, admin_pass,
        policyden_user, policyden_pass, wegenerate_user, wegenerate_pass,
        agent_map,
        headed=args.headed,
        slow_mo=args.slow_mo,
        trace_dir=args.trace,
        video_dir=args.video,
        dry_run=args.dry_run,
        freeze=args.freeze,
        skip_weekends=args.skip_weekends,
        delete_weekends=args.delete_weekends,
    ))


if __name__ == "__main__":
    sys.exit(main())
