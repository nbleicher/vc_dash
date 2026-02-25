#!/usr/bin/env python3
"""
PolicyDen Policies bot: scrape /policies for the current month (no status filter),
sync audit records so only pending_cms and flagged appear as action needed, and
update existing records when PolicyDen status changes (e.g. to accepted/issued/placed).

Requires: .env (API_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD), auth_policyden.json,
agent_map.json. Same auth as the main sales bot.
"""

import json
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

try:
    from playwright_stealth import stealth_sync
except ImportError:
    stealth_sync = None

ZONE = "America/New_York"
POLICYDEN_POLICIES = "https://app.policyden.com/policies"

# Table columns (0-based): checkbox, NO/CONTACT, MEDICARE NO, STATUS, POLICY TYPE, SALE DATE, CARRIER, AGENT, AGENCY
COL_CONTACT = 1
COL_STATUS = 3
COL_CARRIER = 6
COL_AGENT = 7

# Status slugs we care about
ACTION_NEEDED_STATUSES = {"pending_cms", "flagged"}
POSITIVE_STATUSES = {"accepted", "issued", "placed"}  # drop from action needed

# Carrier normalization: PolicyDen display -> dashboard (Aetna, UHC, Humana only)
CARRIER_MAP = {
    "careplus": "Humana",
    "united health care": "UHC",
    "united healthcare": "UHC",
    "uhc": "UHC",
    "aetna": "Aetna",
    "humana": "Humana",
}
ALLOWED_CARRIERS = {"Aetna", "UHC", "Humana"}


def _normalize_status_label(raw: str) -> str:
    s = (raw or "").strip().lower().replace(" ", "_").replace("-", "_")
    if "pending" in s and "cms" in s:
        return "pending_cms"
    if s == "flagged":
        return "flagged"
    if s == "accepted":
        return "accepted"
    if s == "issued":
        return "issued"
    if s == "placed":
        return "placed"
    if s == "unknown":
        return "unknown"
    return s if s else "unknown"


def _normalize_carrier(raw: str) -> Optional[str]:
    key = (raw or "").strip().lower()
    if not key:
        return None
    if key in CARRIER_MAP:
        return CARRIER_MAP[key]
    if raw.strip() in ALLOWED_CARRIERS:
        return raw.strip()
    return None


def log(msg: str) -> None:
    print(msg, flush=True)


def load_agent_map(bot_dir: Path) -> dict[str, str]:
    path = bot_dir / "agent_map.json"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def set_date_this_month(page) -> bool:
    """Open date picker, click This Month, click Apply. Return True if done."""
    try:
        date_trigger = page.locator("button#date, button:has-text('Pick a date range')").first
        date_trigger.click(timeout=5000)
        page.wait_for_timeout(700)
        popover = page.locator('[id^="reka-popover-content-"], [role="dialog"]').first
        try:
            popover.wait_for(state="visible", timeout=4000)
        except Exception:
            pass
        page.wait_for_timeout(400)
        this_month = popover.locator('button:has-text("This Month")').first
        if this_month.count() == 0:
            this_month = page.locator('button:has-text("This Month")').first
        if this_month.count() > 0:
            this_month.click(timeout=2000)
            page.wait_for_timeout(500)
        apply_btn = page.locator('button:has-text("Apply")').first
        for _ in range(30):
            if apply_btn.is_enabled():
                break
            page.wait_for_timeout(200)
        apply_btn.click(timeout=5000)
        page.wait_for_timeout(1500)
        return True
    except Exception as e:
        log(f"  Date picker (This Month) failed: {e}")
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
        return False


def scrape_policies_table(page, agent_map: dict[str, str]) -> list[dict]:
    """Return list of { agent_name, agent_id, client_name, status, carrier }."""
    try:
        page.wait_for_selector("td[data-slot='table-cell']", state="attached", timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(1000)
    rows = page.query_selector_all("table tbody tr")
    if len(rows) == 0:
        rows = page.query_selector_all("[role='row']")
    out: list[dict] = []
    for row in rows:
        cells = row.query_selector_all("td")
        if len(cells) <= max(COL_STATUS, COL_CARRIER, COL_AGENT):
            continue
        client_name = ""
        contact_cell = cells[COL_CONTACT] if COL_CONTACT < len(cells) else None
        if contact_cell:
            a = contact_cell.query_selector('a[href*="/contacts/"]')
            if a:
                client_name = (a.inner_text() or "").strip()
            if not client_name:
                client_name = (contact_cell.inner_text() or "").strip().split("\n")[-1].strip()
        if not client_name:
            continue
        status_raw = (cells[COL_STATUS].inner_text() or "").strip() if COL_STATUS < len(cells) else ""
        agent_name = (cells[COL_AGENT].inner_text() or "").strip() if COL_AGENT < len(cells) else ""
        carrier_raw = (cells[COL_CARRIER].inner_text() or "").strip() if COL_CARRIER < len(cells) else ""
        status = _normalize_status_label(status_raw)
        carrier = _normalize_carrier(carrier_raw)
        if carrier not in ALLOWED_CARRIERS:
            continue
        agent_id = agent_map.get(agent_name)
        if not agent_id:
            continue
        out.append({
            "agent_name": agent_name,
            "agent_id": agent_id,
            "client_name": client_name,
            "status": status,
            "carrier": carrier,
        })
    return out


def scrape_policyden_policies(auth_path: Path, bot_dir: Path, agent_map: dict[str, str]) -> list[dict]:
    from playwright.sync_api import sync_playwright

    if not auth_path.exists():
        log("  auth_policyden.json not found.")
        return []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=str(auth_path))
        page = context.new_page()
        if stealth_sync:
            stealth_sync(page)
        try:
            page.goto(POLICYDEN_POLICIES, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2500)
            set_date_this_month(page)
            page.wait_for_timeout(2000)
            policies = scrape_policies_table(page, agent_map)
            log(f"  PolicyDen policies: scraped {len(policies)} rows (valid agent + carrier).")
        except Exception as e:
            log(f"  PolicyDen policies scrape failed: {e}")
            policies = []
        finally:
            browser.close()
    return policies


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


def api_get_audit_records(session, base_url: str) -> list[dict]:
    r = session.get(
        f"{base_url.rstrip('/')}/state/auditRecords",
        timeout=15,
        headers={"Cache-Control": "no-cache", "Pragma": "no-cache"},
    )
    if r.status_code != 200:
        log(f"  GET /state/auditRecords failed: {r.status_code}")
        return []
    data = r.json()
    return data.get("data", data) if isinstance(data, dict) else []


def api_put_audit_records(session, base_url: str, records: list[dict]) -> bool:
    r = session.put(
        f"{base_url.rstrip('/')}/state/auditRecords",
        json=records,
        timeout=15,
    )
    if r.status_code != 200:
        log(f"  PUT /state/auditRecords failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def main() -> int:
    from datetime import datetime, timezone
    from zoneinfo import ZoneInfo

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

    agent_map = load_agent_map(bot_dir)
    if not agent_map:
        log("agent_map.json not found or empty; exiting.")
        return 1

    tz = ZoneInfo(ZONE)
    now = datetime.now(tz)
    now_iso = now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    current_month = now.strftime("%Y-%m")

    log("Scraping PolicyDen /policies (this month, all statuses)...")
    auth_policyden = bot_dir / "auth_policyden.json"
    scraped = scrape_policyden_policies(auth_policyden, bot_dir, agent_map)

    import requests
    session = requests.Session()
    session.headers["Content-Type"] = "application/json"
    if not api_login(session, api_base, admin_user, admin_pass):
        return 1

    existing = api_get_audit_records(session, api_base)
    current_month_prefix = current_month + "-"
    by_client_agent: dict[tuple[str, str], dict] = {}
    for r in existing:
        discovery = r.get("discoveryTs") or ""
        if discovery.startswith(current_month_prefix):
            key = (r.get("clientName", "").strip(), r.get("agentId", ""))
            by_client_agent[key] = r

    added = 0
    updated = 0

    for row in scraped:
        client_name = row["client_name"]
        agent_id = row["agent_id"]
        status = row["status"]
        carrier = row["carrier"]
        key = (client_name, agent_id)
        rec = by_client_agent.get(key)

        if status in ACTION_NEEDED_STATUSES:
            if rec is None:
                new_id = f"audit_{uuid.uuid4()}"
                reason = f"PolicyDen: {'Pending CMS' if status == 'pending_cms' else 'Flagged'}"
                new_rec = {
                    "id": new_id,
                    "agentId": agent_id,
                    "carrier": carrier,
                    "clientName": client_name,
                    "reason": reason,
                    "currentStatus": status,
                    "discoveryTs": now_iso,
                    "mgmtNotified": False,
                    "outreachMade": False,
                    "resolutionTs": None,
                    "notes": "",
                }
                existing.append(new_rec)
                by_client_agent[key] = new_rec
                added += 1
            else:
                if rec.get("currentStatus") != status:
                    rec["currentStatus"] = status
                    rec["reason"] = f"PolicyDen: {'Pending CMS' if status == 'pending_cms' else 'Flagged'}"
                    rec["resolutionTs"] = None
                    updated += 1
        elif status in POSITIVE_STATUSES:
            if rec is not None and rec.get("currentStatus") in ACTION_NEEDED_STATUSES:
                rec["currentStatus"] = status
                rec["resolutionTs"] = now_iso
                rec["reason"] = f"PolicyDen: {status.replace('_', ' ').title()}"
                updated += 1

    if added or updated:
        if api_put_audit_records(session, api_base, existing):
            log(f"Synced audit records: added {added}, updated {updated}.")
        else:
            return 1
    else:
        log("No audit record changes to push.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
