#!/usr/bin/env python3
"""
Backfill EOD performance by scraping historical data from PolicyDen and WeGenerate.

When run interactively (TTY), prompts: "Press 1 for headless, 2 for headed". Option 2
delegates to backfill_headed.py (visible browser). When run non-interactively (e.g. cron),
always uses headless.

For each date in a given range, this script:
- Scrapes PolicyDen (sales) and WeGenerate (calls + marketing) using the existing scrapers.
- Writes/overwrites snapshots for (dateKey, slot) and sets house-level marketing for that date.
- Optionally runs eod.py --backfill-range to freeze perf_history for the same range.

Usage examples:
  # Backfill from a start date up to yesterday (default slot=17:00)
  ./venv/bin/python backfill.py --start 2025-03-01

  # Backfill an explicit date range
  ./venv/bin/python backfill.py --start 2025-03-01 --end 2025-03-07

  # Backfill and immediately freeze perf_history for that range
  ./venv/bin/python backfill.py --start 2025-03-01 --end 2025-03-07 --slot 17:00 --freeze
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import requests
from dotenv import load_dotenv
from zoneinfo import ZoneInfo

from http_retry import request_with_retries

from main import (  # type: ignore[import]
    SLOT_CONFIG,
    ZONE,
    _run_scrapes_async,
    api_get_state,
    api_login,
    api_put_snapshots,
    api_set_house_marketing,
    load_agent_map,
    log,
    merge_snapshots,
)


@dataclass
class BackfillConfig:
    start: date
    end: date
    slot_key: str
    slot_label: str
    freeze: bool
    dry_run: bool


def parse_args() -> BackfillConfig:
    parser = argparse.ArgumentParser(
        description="Backfill snapshots and optional perf_history from PolicyDen/WeGenerate for a date range."
    )
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument(
        "--end",
        help="End date (YYYY-MM-DD, inclusive). Defaults to yesterday in EST if omitted.",
    )
    parser.add_argument(
        "--slot",
        default="17:00",
        help="Slot key to use when writing snapshots (default: 17:00). Must match a key in SLOT_CONFIG.",
    )
    parser.add_argument(
        "--freeze",
        action="store_true",
        help="After writing snapshots for the date range, run eod.py --backfill-range START END.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scrape and log what would be written without calling any PUT/POST APIs.",
    )
    args = parser.parse_args()

    try:
        start = datetime.strptime(args.start.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise SystemExit("Invalid --start date, expected YYYY-MM-DD")

    if args.end:
        try:
            end = datetime.strptime(args.end.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise SystemExit("Invalid --end date, expected YYYY-MM-DD")
    else:
        tz = ZoneInfo(ZONE)
        now_est = datetime.now(tz)
        end = (now_est.date() - timedelta(days=1))

    if end < start:
        raise SystemExit("--end must be >= --start")

    slot_key = args.slot.strip()
    slot_label = next(
        (slot["label"] for slot in SLOT_CONFIG if slot.get("key") == slot_key),
        "",
    )
    if not slot_label:
        log(f"WARNING: slot {slot_key!r} not found in SLOT_CONFIG; using generic label.")
        slot_label = f"{slot_key} slot"

    return BackfillConfig(
        start=start,
        end=end,
        slot_key=slot_key,
        slot_label=slot_label,
        freeze=bool(args.freeze),
        dry_run=bool(args.dry_run),
    )


def iter_date_keys(start: date, end: date) -> Iterable[str]:
    current = start
    while current <= end:
        yield current.strftime("%Y-%m-%d")
        current += timedelta(days=1)


async def scrape_for_date(
    auth_policyden: Path,
    auth_wegenerate: Path,
    date_key: str,
    bot_dir: Path,
    policyden_user: str,
    policyden_pass: str,
    wegenerate_user: str,
    wegenerate_pass: str,
) -> tuple[dict[str, int], dict[str, int], dict[str, float], float | None]:
    log(f"=== {date_key}: running scrapers ===")
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
    return sales_by_agent, calls_by_agent, marketing_by_agent, campaign_marketing


def build_new_snapshot_rows(
    date_key: str,
    slot_key: str,
    slot_label: str,
    agent_map: dict[str, str],
    active_ids: set[str],
    existing_snapshots: list[dict],
    sales_by_agent: dict[str, int],
    calls_by_agent: dict[str, int],
    marketing_by_agent: dict[str, float],
) -> list[dict]:
    from uuid import uuid4

    existing_by_key = {
        (s.get("dateKey"), s.get("slot"), s.get("agentId")): s for s in existing_snapshots
    }

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    new_rows: list[dict] = []

    for display_name, agent_id in agent_map.items():
        if agent_id not in active_ids:
            continue
        sales = int(sales_by_agent.get(display_name, 0) or 0)
        calls = int(calls_by_agent.get(display_name, 0) or 0)
        existing = existing_by_key.get((date_key, slot_key, agent_id))
        if display_name in marketing_by_agent:
            marketing_val = float(marketing_by_agent[display_name])
        elif existing and isinstance(existing.get("marketing"), (int, float)):
            marketing_val = float(existing["marketing"])  # type: ignore[arg-type]
        else:
            marketing_val = None
        snap_id = existing["id"] if existing and existing.get("id") else f"snap_{uuid4()}"
        new_rows.append(
            {
                "id": snap_id,
                "dateKey": date_key,
                "slot": slot_key,
                "slotLabel": slot_label,
                "agentId": agent_id,
                "billableCalls": calls,
                "sales": sales,
                "marketing": marketing_val,
                "updatedAt": now_iso,
            }
        )
    return new_rows


def run_freeze_backfill(start_key: str, end_key: str) -> int:
    script_path = Path(__file__).resolve().with_name("eod.py")
    if not script_path.exists():
        log(f"eod.py not found at {script_path}; skipping --freeze step.")
        return 1
    cmd = [sys.executable, str(script_path), "--backfill-range", start_key, end_key]
    log(f"Running eod backfill: {' '.join(cmd)}")
    try:
        completed = subprocess.run(cmd, check=False)
        return completed.returncode
    except Exception as e:
        log(f"Error running eod.py: {e}")
        return 1


def main() -> int:
    load_dotenv()
    cfg = parse_args()

    # Interactive prompt: headless (1) or headed (2). Skip when not a TTY (e.g. cron).
    if sys.stdin.isatty():
        try:
            choice = input("Press 1 for headless, 2 for headed [1]: ").strip() or "1"
        except (EOFError, KeyboardInterrupt):
            choice = "1"
        if choice == "2":
            bot_dir = Path(__file__).resolve().parent
            headed_script = bot_dir / "backfill_headed.py"
            if not headed_script.exists():
                log(f"backfill_headed.py not found at {headed_script}; running headless.")
            else:
                cmd = [
                    sys.executable,
                    str(headed_script),
                    "--start",
                    cfg.start.strftime("%Y-%m-%d"),
                    "--end",
                    cfg.end.strftime("%Y-%m-%d"),
                    "--slot",
                    cfg.slot_key,
                ]
                if cfg.freeze:
                    cmd.append("--freeze")
                if cfg.dry_run:
                    cmd.append("--dry-run")
                log(f"Running headed backfill: {' '.join(cmd)}")
                return subprocess.run(cmd).returncode

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

    policyden_user = os.environ.get("POLICYDEN_USERNAME", "").strip()
    policyden_pass = os.environ.get("POLICYDEN_PASSWORD", "").strip()
    wegenerate_user = os.environ.get("WEGENERATE_USERNAME", "").strip()
    wegenerate_pass = os.environ.get("WEGENERATE_PASSWORD", "").strip()

    bot_dir = Path(__file__).resolve().parent
    auth_policyden = bot_dir / "auth_policyden.json"
    auth_wegenerate = bot_dir / "auth_wegenerate.json"

    agent_map = load_agent_map(bot_dir)
    if not agent_map:
        log("No agent_map.json; exiting without backfill.")
        return 1

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

    log(
        f"Backfill range: {cfg.start} .. {cfg.end} (slot={cfg.slot_key}, freeze={cfg.freeze}, dry_run={cfg.dry_run})"
    )

    try:
        for date_key in iter_date_keys(cfg.start, cfg.end):
            sales_by_agent: dict[str, int]
            calls_by_agent: dict[str, int]
            marketing_by_agent: dict[str, float]
            campaign_marketing: float | None

            sales_by_agent, calls_by_agent, marketing_by_agent, campaign_marketing = asyncio.run(
                scrape_for_date(
                    auth_policyden,
                    auth_wegenerate,
                    date_key,
                    bot_dir,
                    policyden_user,
                    policyden_pass,
                    wegenerate_user,
                    wegenerate_pass,
                )
            )

            if not sales_by_agent and not calls_by_agent:
                log(
                    f"  {date_key}: both scrapers returned no data. "
                    "Check sessions (capture.py) or selectors; skipping snapshot write."
                )
                continue

            new_rows = build_new_snapshot_rows(
                date_key=date_key,
                slot_key=cfg.slot_key,
                slot_label=cfg.slot_label,
                agent_map=agent_map,
                active_ids=active_ids,
                existing_snapshots=snapshots,
                sales_by_agent=sales_by_agent,
                calls_by_agent=calls_by_agent,
                marketing_by_agent=marketing_by_agent,
            )
            if not new_rows:
                log(f"  {date_key}: no snapshot rows to push (check agent_map and active agents).")
                continue

            merged = merge_snapshots(snapshots, new_rows, date_key, cfg.slot_key)

            if cfg.dry_run:
                log(f"  {date_key}: [dry-run] would push {len(new_rows)} snapshots.")
                if campaign_marketing is not None:
                    log(
                        f"  {date_key}: [dry-run] would set house marketing to ${campaign_marketing:,.2f}."
                    )
                snapshots = merged
                continue

            if not api_put_snapshots(session, api_base, merged):
                log(f"  {date_key}: PUT /state/snapshots failed; leaving local state unchanged.")
                continue

            snapshots = merged
            log(f"  {date_key}: pushed {len(new_rows)} snapshots for slot {cfg.slot_key}.")

            if campaign_marketing is not None:
                if api_set_house_marketing(session, api_base, date_key, campaign_marketing):
                    log(
                        f"  {date_key}: set house marketing from WeGenerate campaign total "
                        f"${campaign_marketing:,.2f}."
                    )
                else:
                    log(f"  {date_key}: failed to set house marketing.")

    except KeyboardInterrupt:
        log("Backfill interrupted (Ctrl+C).")
        return 130

    if cfg.freeze and not cfg.dry_run:
        start_key = cfg.start.strftime("%Y-%m-%d")
        end_key = cfg.end.strftime("%Y-%m-%d")
        rc = run_freeze_backfill(start_key, end_key)
        if rc != 0:
            log("eod backfill exited with non-zero status.")
            return rc

    log("Backfill complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

