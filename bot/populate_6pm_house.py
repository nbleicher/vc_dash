#!/usr/bin/env python3
"""
Populate house CPA and sales at 6:00 PM EST daily.
Fetches current state, computes house totals from today's snapshots (prefer 5 PM slot),
and appends/updates the house6pmSnapshots collection so the EOD Report task can show 6 PM values.

Cron (6:00 PM EST daily; set CRON_TZ=America/New_York):
  0 18 * * * cd /path/to/bot && ./venv/bin/python populate_6pm_house.py >> populate_6pm.log 2>&1

Uses same .env as bot: API_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD.
"""

import os
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

ZONE = "America/New_York"
SLOT_ORDER = ("17:00", "15:00", "13:00", "11:00")


def log(msg: str) -> None:
    print(msg, flush=True)


def get_date_key_est() -> str:
    return datetime.now(ZoneInfo(ZONE)).strftime("%Y-%m-%d")


def api_login(session: requests.Session, base_url: str, username: str, password: str) -> bool:
    r = session.post(
        f"{base_url.rstrip('/')}/auth/login",
        json={"username": username, "password": password},
        timeout=15,
    )
    if r.status_code != 200:
        log(f"  Login failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def api_get_state(session: requests.Session, base_url: str) -> dict | None:
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


def api_put_house6pm_snapshots(session: requests.Session, base_url: str, snapshots: list) -> bool:
    r = session.put(
        f"{base_url.rstrip('/')}/state/house6pmSnapshots",
        json=snapshots,
        timeout=15,
    )
    if r.status_code != 200:
        log(f"  PUT /state/house6pmSnapshots failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def main() -> int:
    load_dotenv()
    api_base = os.environ.get("API_BASE_URL", "").strip()
    if not api_base:
        log("Set API_BASE_URL in .env")
        return 1
    if not api_base.startswith("http"):
        api_base = "https://" + api_base
    admin_user = os.environ.get("ADMIN_USERNAME", "").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "").strip()
    if not admin_user or not admin_pass:
        log("Set ADMIN_USERNAME, ADMIN_PASSWORD in .env")
        return 1

    now = datetime.now(ZoneInfo(ZONE))
    if now.hour < 18:
        log("Before 6:00 PM EST; skipping (run at 6:00 PM or later).")
        return 0

    date_key = get_date_key_est()
    session = requests.Session()
    session.headers["Content-Type"] = "application/json"

    if not api_login(session, api_base, admin_user, admin_pass):
        return 1
    state = api_get_state(session, api_base)
    if not state:
        return 1

    agents = state.get("agents") or []
    active_ids = {a["id"] for a in agents if a.get("active")}
    snapshots = state.get("snapshots") or []
    existing_6pm = state.get("house6pmSnapshots") or []

    today_snapshots = [s for s in snapshots if s.get("dateKey") == date_key]
    slot_priority = {k: i for i, k in enumerate(SLOT_ORDER)}

    total_sales = 0
    total_marketing = 0.0
    for agent in agents:
        if agent["id"] not in active_ids:
            continue
        agent_id = agent["id"]
        agent_snaps = [s for s in today_snapshots if s.get("agentId") == agent_id]
        exact_17 = next((s for s in agent_snaps if s.get("slot") == "17:00"), None)
        source = exact_17
        if not source and agent_snaps:
            source = max(
                agent_snaps,
                key=lambda s: slot_priority.get(s.get("slot", ""), -1),
            )
        if not source:
            continue
        calls = source.get("billableCalls", 0) or 0
        sales = source.get("sales", 0) or 0
        total_sales += sales
        total_marketing += calls * 15

    house_cpa = (total_marketing / total_sales) if total_sales > 0 else None
    captured_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    new_entry = {
        "dateKey": date_key,
        "houseSales": total_sales,
        "houseCpa": house_cpa,
        "capturedAt": captured_at,
    }

    merged = [e for e in existing_6pm if e.get("dateKey") != date_key]
    merged.append(new_entry)
    merged.sort(key=lambda e: e.get("dateKey", ""), reverse=True)

    if api_put_house6pm_snapshots(session, api_base, merged):
        log(f"Populated 6 PM house snapshot for {date_key}: sales={total_sales}, cpa={house_cpa}.")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
