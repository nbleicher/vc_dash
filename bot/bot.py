#!/usr/bin/env python3
"""
VPS intra-day bot: scrape PolicyDen (sales) and WeGenerate (calls), merge into
dashboard snapshots via API. Run every 10 min via cron.

The dashboard Agent Performance card uses the latest snapshot per agent; there is
no manual intra-day entry and no intra-performance alert.

Requires on VPS: .env (API_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD),
auth_policyden.json, auth_wegenerate.json, agent_map.json.
"""

import json
import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv

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
# WeGenerate /dashboard Agent Performance: Rank(0), Agent(1), Billable(2), Sales(3), ...
SELECTORS_WEGENERATE = {
    "date_trigger": 'button#date',
    "date_apply": 'button:has-text("Apply")',
    "table_rows": "table tbody tr",
    "col_agent": 1,   # Agent column (e.g. Alexander Vielot)
    "col_calls": 2,   # Billable column (e.g. 14)
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
    if not selectors.get("date_trigger") or not selectors.get("date_apply"):
        log("  Date selectors not configured; skipping date filter (using page default).")
        return False
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeout
        page.click(selectors["date_trigger"], timeout=5000)
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


def scrape_policyden(auth_path: Path, date_key: str, bot_dir: Path) -> dict[str, int]:
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
        except Exception as e:
            log(f"  PolicyDen scrape failed: {e}")
        finally:
            browser.close()
    return out


def scrape_wegenerate(auth_path: Path, date_key: str, bot_dir: Path) -> dict[str, int]:
    """Return { agent_name: billable_calls }."""
    from playwright.sync_api import sync_playwright

    out: dict[str, int] = {}
    if not auth_path.exists():
        log("  auth_wegenerate.json not found; skipping WeGenerate.")
        return out

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=str(auth_path))
        page = context.new_page()
        if stealth_sync:
            stealth_sync(page)
        try:
            page.goto(WEGENERATE_DASHBOARD, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)
            set_date_on_page(page, date_key, SELECTORS_WEGENERATE)

            rows_sel = SELECTORS_WEGENERATE.get("table_rows") or "table tbody tr"
            col_agent = SELECTORS_WEGENERATE.get("col_agent")
            col_calls = SELECTORS_WEGENERATE.get("col_calls")

            rows = page.query_selector_all(rows_sel)
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
        finally:
            browser.close()
    return out


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
    r = session.get(f"{base_url.rstrip('/')}/state", timeout=15)
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

    agent_map = load_agent_map(bot_dir)
    if not agent_map:
        log("No agent_map.json; exiting.")
        return 0

    auth_policyden = bot_dir / "auth_policyden.json"
    auth_wegenerate = bot_dir / "auth_wegenerate.json"

    log("Scraping PolicyDen (sales)...")
    sales_by_agent = scrape_policyden(auth_policyden, date_key, bot_dir)
    log("Scraping WeGenerate (calls)...")
    calls_by_agent = scrape_wegenerate(auth_wegenerate, date_key, bot_dir)

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

    now_iso = __import__("datetime").datetime.now(__import__("zoneinfo").ZoneInfo(ZONE)).isoformat(timespec="seconds") + "Z"
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

    if not new_rows:
        log("No snapshot rows to push (check agent_map and active agents).")
        return 0

    merged = merge_snapshots(existing_snapshots, new_rows, date_key, slot_key)
    if api_put_snapshots(session, api_base, merged):
        log(f"Pushed {len(new_rows)} snapshots for {date_key} {slot_key}.")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
