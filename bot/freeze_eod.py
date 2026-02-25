#!/usr/bin/env python3
"""
EOD freeze: at 11:50 PM EST, copy today's snapshots into perfHistory so EOD/weekly totals are saved.
Run on the VPS via cron so the freeze happens even when the dashboard is closed.

Cron (11:50 PM EST daily; set CRON_TZ=America/New_York or use TZ in the job):
  50 23 * * * cd /home/ubuntu/bot && /home/ubuntu/bot/venv/bin/python freeze_eod.py >> /home/ubuntu/bot/freeze.log 2>&1

Uses same .env as bot: API_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD.
"""

import os
import sys
import uuid
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


def compute_metrics(calls: int, sales: int) -> dict:
    marketing = calls * 15
    cpa = (marketing / sales) if sales > 0 else None
    cvr = (sales / calls) if calls > 0 else None
    return {"marketing": marketing, "cpa": cpa, "cvr": cvr}


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


def api_put_perf_history(session: requests.Session, base_url: str, perf_history: list) -> bool:
    r = session.put(
        f"{base_url.rstrip('/')}/state/perfHistory",
        json=perf_history,
        timeout=15,
    )
    if r.status_code != 200:
        log(f"  PUT /state/perfHistory failed: {r.status_code} {r.text[:200]}")
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
    if now.hour < 23 or (now.hour == 23 and now.minute < 50):
        log("Before 11:50 PM EST; skipping (run at 11:50 PM or later).")
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
    perf_history = state.get("perfHistory") or []

    if any(p.get("dateKey") == date_key for p in perf_history):
        log(f"perfHistory already has rows for {date_key}; skipping.")
        return 0

    today_snapshots = [s for s in snapshots if s.get("dateKey") == date_key]
    slot_priority = {k: i for i, k in enumerate(SLOT_ORDER)}

    frozen_rows = []
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
        m = compute_metrics(calls, sales)
        frozen_rows.append({
            "id": f"perf_{uuid.uuid4()}",
            "dateKey": date_key,
            "agentId": agent_id,
            "billableCalls": calls,
            "sales": sales,
            "marketing": m["marketing"],
            "cpa": m["cpa"],
            "cvr": m["cvr"],
            "frozenAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        })

    if not frozen_rows:
        log(f"No snapshots to freeze for {date_key} (no data for active agents).")
        return 0

    merged = perf_history + frozen_rows
    if api_put_perf_history(session, api_base, merged):
        log(f"Froze {len(frozen_rows)} rows for {date_key} (EOD save).")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
