#!/usr/bin/env python3
"""
Set EOD report marketing total for a given date by scaling perf_history rows.
Use when the 11:50 freeze had an old marketing number and you have the correct total.

Usage (from bot directory, same .env as bot):
  ./venv/bin/python set_eod_marketing.py [--date YYYY-MM-DD] [--amount 4354]

Defaults: date = yesterday (EST), amount = 4354.00.
"""

import argparse
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

ZONE = "America/New_York"


def log(msg: str) -> None:
    print(msg, flush=True)


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Set EOD marketing total for a date by scaling perf_history.")
    parser.add_argument("--date", default=None, help="Date key YYYY-MM-DD (default: yesterday EST)")
    parser.add_argument("--amount", type=float, default=4354.0, help="Target marketing total (default: 4354)")
    args = parser.parse_args()

    if args.date:
        date_key = args.date.strip()
    else:
        yesterday = (datetime.now(ZoneInfo(ZONE)) - timedelta(days=1)).strftime("%Y-%m-%d")
        date_key = yesterday

    amount = args.amount
    if amount <= 0 or not isinstance(amount, (int, float)):
        log("Amount must be a positive number.")
        return 1

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

    session = requests.Session()
    session.headers["Content-Type"] = "application/json"

    r = session.post(
        f"{api_base.rstrip('/')}/auth/login",
        json={"username": admin_user, "password": admin_pass},
        timeout=15,
    )
    if r.status_code != 200:
        log(f"Login failed: {r.status_code} {r.text[:200]}")
        return 1

    r = session.get(
        f"{api_base.rstrip('/')}/state",
        timeout=15,
        headers={"Cache-Control": "no-cache", "Pragma": "no-cache"},
    )
    if r.status_code != 200:
        log(f"GET /state failed: {r.status_code}")
        return 1
    data = r.json()
    state = data.get("data") if isinstance(data, dict) else data
    if not state:
        log("Invalid state response.")
        return 1

    perf_history = list(state.get("perfHistory") or [])
    rows = [row for row in perf_history if row.get("dateKey") == date_key]
    if not rows:
        log(f"No perf_history rows for {date_key}. Run the EOD freeze for that date first.")
        return 1

    current_sum = sum(float(row.get("marketing", 0) or 0) for row in rows)
    if current_sum <= 0:
        log(f"Current marketing sum for {date_key} is 0; cannot scale.")
        return 1

    scale = amount / current_sum
    for row in rows:
        m = float(row.get("marketing", 0) or 0) * scale
        row["marketing"] = round(m, 2)
        sales = float(row.get("sales", 0) or 0)
        row["cpa"] = round(row["marketing"] / sales, 4) if sales > 0 else None

    r = session.put(
        f"{api_base.rstrip('/')}/state/perfHistory",
        json=perf_history,
        timeout=15,
    )
    if r.status_code != 200:
        log(f"PUT /state/perfHistory failed: {r.status_code} {r.text[:200]}")
        return 1

    new_sum = sum(row["marketing"] for row in rows)
    log(f"Set EOD marketing for {date_key} to ${new_sum:,.2f} (target ${amount:,.2f}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
