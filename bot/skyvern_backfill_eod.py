#!/usr/bin/env python3
"""
Skyvern-powered EOD backfill: populate historical snapshots and perf_history using
AI-driven browser tasks instead of fixed Playwright selectors.

For each date in a range, runs Skyvern tasks to:
- PolicyDen: set date to YYYY-MM-DD, open Live View, extract per-agent sales.
- WeGenerate: set date to YYYY-MM-DD, extract Agent Performance table and campaign marketing.

Then merges results with existing snapshots, writes via the same VC Dash API as the
intra-day bot, and optionally runs freeze_eod.py --backfill-range.

Requires: Skyvern server running locally (skyvern run server or skyvern run all),
and LLM configured (e.g. OpenClaw via OpenAI-compatible settings). See SKYVERN_BACKFILL.md.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

import requests
from dotenv import load_dotenv
from zoneinfo import ZoneInfo

from bot import (  # type: ignore[import]
    SLOT_CONFIG,
    ZONE,
    api_get_state,
    api_login,
    api_put_snapshots,
    api_set_house_marketing,
    load_agent_map,
    log,
    merge_snapshots,
)

# PolicyDen dashboard and WeGenerate dashboard URLs (same as bot.py)
POLICYDEN_DASHBOARD = "https://app.policyden.com/dashboard"
WEGENERATE_DASHBOARD = "https://app.wegenerate.com/dashboard"


# --- Data extraction schemas for Skyvern (JSON Schema) ---
POLICYDEN_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "agents": {
            "type": "array",
            "description": "List of agent names and their sales counts for the selected date",
            "items": {
                "type": "object",
                "properties": {
                    "agent": {"type": "string", "description": "Agent display name exactly as shown in the table"},
                    "sales": {"type": "integer", "description": "Total sales count for this agent"},
                },
                "required": ["agent", "sales"],
            },
        }
    },
    "required": ["agents"],
}

WEGENERATE_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "agents": {
            "type": "array",
            "description": "Agent Performance table: agent name, billable calls, marketing amount",
            "items": {
                "type": "object",
                "properties": {
                    "agent": {"type": "string", "description": "Agent display name exactly as shown"},
                    "calls": {"type": "integer", "description": "Billable calls count"},
                    "marketing": {"type": "number", "description": "Marketing dollar amount for this agent"},
                },
                "required": ["agent", "calls"],
            },
        },
        "campaign_marketing": {
            "type": "number",
            "description": "Total campaign marketing amount for the date (single number from Campaign Performance section)",
        },
    },
    "required": ["agents"],
}


@dataclass
class BackfillConfig:
    start: date
    end: date
    slot_key: str
    slot_label: str
    freeze: bool
    dry_run: bool
    verbose: bool


def parse_args() -> BackfillConfig:
    parser = argparse.ArgumentParser(
        description="Backfill snapshots and perf_history using Skyvern (AI) for PolicyDen/WeGenerate."
    )
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument(
        "--end",
        help="End date (YYYY-MM-DD, inclusive). Defaults to yesterday in EST if omitted.",
    )
    parser.add_argument(
        "--slot",
        default="17:00",
        help="Slot key for snapshots (default: 17:00). Must match SLOT_CONFIG.",
    )
    parser.add_argument(
        "--freeze",
        action="store_true",
        help="After writing snapshots, run freeze_eod.py --backfill-range START END.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run Skyvern and log what would be written; do not call PUT/POST APIs.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Log normalized tables and extra detail per date.",
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
        end = now_est.date() - timedelta(days=1)

    if end < start:
        raise SystemExit("--end must be >= --start")

    slot_key = args.slot.strip()
    slot_label = next(
        (s["label"] for s in SLOT_CONFIG if s.get("key") == slot_key),
        "",
    )
    if not slot_label:
        log(f"WARNING: slot {slot_key!r} not in SLOT_CONFIG; using generic label.")
        slot_label = f"{slot_key} slot"

    return BackfillConfig(
        start=start,
        end=end,
        slot_key=slot_key,
        slot_label=slot_label,
        freeze=bool(args.freeze),
        dry_run=bool(args.dry_run),
        verbose=bool(args.verbose),
    )


def iter_date_keys(start: date, end: date) -> Iterable[str]:
    current = start
    while current <= end:
        yield current.strftime("%Y-%m-%d")
        current += timedelta(days=1)


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


def run_freeze_backfill(start_key: str, end_key: str) -> int:
    script_path = Path(__file__).resolve().with_name("freeze_eod.py")
    if not script_path.exists():
        log(f"freeze_eod.py not found at {script_path}; skipping --freeze step.")
        return 1
    cmd = [sys.executable, str(script_path), "--backfill-range", start_key, end_key]
    log(f"Running freeze_eod backfill: {' '.join(cmd)}")
    try:
        completed = subprocess.run(cmd, check=False)
        return completed.returncode
    except Exception as e:
        log(f"Error running freeze_eod.py: {e}")
        return 1


def _normalize_policyden_output(output: Any) -> dict[str, int]:
    """Convert Skyvern PolicyDen task output to { agent_name: sales }."""
    out: dict[str, int] = {}
    if output is None:
        return out
    if isinstance(output, dict) and "agents" in output:
        for row in output.get("agents") or []:
            if isinstance(row, dict):
                name = (row.get("agent") or "").strip()
                if name:
                    try:
                        out[name] = out.get(name, 0) + int(row.get("sales") or 0)
                    except (TypeError, ValueError):
                        pass
    return out


def _normalize_wegenerate_output(output: Any) -> tuple[dict[str, int], dict[str, float], float | None]:
    """Convert Skyvern WeGenerate task output to (calls_by_agent, marketing_by_agent, campaign_marketing)."""
    calls: dict[str, int] = {}
    marketing: dict[str, float] = {}
    campaign: float | None = None
    if output is None:
        return calls, marketing, campaign
    if isinstance(output, dict):
        campaign_raw = output.get("campaign_marketing")
        if campaign_raw is not None:
            try:
                campaign = float(campaign_raw)
            except (TypeError, ValueError):
                pass
        for row in output.get("agents") or []:
            if not isinstance(row, dict):
                continue
            name = (row.get("agent") or "").strip()
            if not name:
                continue
            try:
                calls[name] = calls.get(name, 0) + int(row.get("calls") or 0)
            except (TypeError, ValueError):
                pass
            m = row.get("marketing")
            if m is not None:
                try:
                    marketing[name] = marketing.get(name, 0.0) + float(m)
                except (TypeError, ValueError):
                    pass
    return calls, marketing, campaign


async def run_policyden_task(skyvern: Any, date_key: str, verbose: bool) -> dict[str, int]:
    """Run Skyvern task for PolicyDen sales on date_key; return { agent: sales }."""
    prompt = (
        f"Go to the PolicyDen dashboard. Open the date picker and set the date to {date_key}. "
        "Apply the date. If there is an 'Open Live View' button, click it to open the live leaderboard. "
        f"Extract the table of agents and their total sales for the selected date ({date_key}). "
        "Use the agent name exactly as shown in the table (first column or name column)."
    )
    try:
        task = await skyvern.run_task(
            url=POLICYDEN_DASHBOARD,
            prompt=prompt,
            data_extraction_schema=POLICYDEN_EXTRACTION_SCHEMA,
            wait_for_completion=True,
        )
        output = getattr(task, "output", None) or getattr(task, "extracted_data", None)
        result = _normalize_policyden_output(output)
        if verbose:
            log(f"  [verbose] PolicyDen {date_key}: {result}")
        return result
    except Exception as e:
        err_str = str(e).lower()
        if "403" in err_str or "could not validate credentials" in err_str or "credentials" in err_str:
            log("  Hint: 403 usually means SKYVERN_API_KEY is missing or invalid. Use the token from your Skyvern DB (see SKYVERN_BACKFILL.md).")
        log(f"  PolicyDen Skyvern task failed for {date_key}: {e}")
        return {}


async def run_wegenerate_task(
    skyvern: Any, date_key: str, verbose: bool
) -> tuple[dict[str, int], dict[str, float], float | None]:
    """Run Skyvern task for WeGenerate calls/marketing on date_key."""
    prompt = (
        f"Go to the WeGenerate dashboard. Open the date picker and set the date to {date_key}. "
        "Apply the date. Find the 'Agent Performance' table and extract each row: agent name, "
        "billable calls, and marketing amount. Also find the Campaign Performance section and "
        f"extract the total campaign marketing amount for the date ({date_key}). "
        "Use agent names exactly as shown in the table."
    )
    try:
        task = await skyvern.run_task(
            url=WEGENERATE_DASHBOARD,
            prompt=prompt,
            data_extraction_schema=WEGENERATE_EXTRACTION_SCHEMA,
            wait_for_completion=True,
        )
        output = getattr(task, "output", None) or getattr(task, "extracted_data", None)
        calls, marketing, campaign = _normalize_wegenerate_output(output)
        if verbose:
            log(f"  [verbose] WeGenerate {date_key}: calls={calls}, marketing={marketing}, campaign_marketing={campaign}")
        return calls, marketing, campaign
    except Exception as e:
        err_str = str(e).lower()
        if "403" in err_str or "could not validate credentials" in err_str or "credentials" in err_str:
            log("  Hint: 403 usually means SKYVERN_API_KEY is missing or invalid. Use the token from your Skyvern DB (see SKYVERN_BACKFILL.md).")
        log(f"  WeGenerate Skyvern task failed for {date_key}: {e}")
        return {}, {}, None


async def main_async() -> int:
    load_dotenv()
    cfg = parse_args()

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

    bot_dir = Path(__file__).resolve().parent
    agent_map = load_agent_map(bot_dir)
    if not agent_map:
        log("No agent_map.json; exiting.")
        return 1

    try:
        from skyvern import Skyvern
    except ImportError:
        log("Skyvern SDK not installed. Run: pip install skyvern")
        return 1

    # Skyvern API key is OFF by default: use Skyvern.local() (in-process, no key). Set SKYVERN_API_KEY only to connect to a separate server.
    use_local = os.environ.get("SKYVERN_USE_LOCAL", "").strip().lower() in ("1", "true", "yes")
    skyvern_api_key = os.environ.get("SKYVERN_API_KEY", "").strip() if not use_local else ""
    if use_local or not skyvern_api_key:
        log("Using Skyvern local mode (in-process). API key off; no separate server required.")
        skyvern = Skyvern.local()
    else:
        skyvern_base = os.environ.get("SKYVERN_BASE_URL", "http://localhost:8000").strip()
        log(f"Connecting to Skyvern server at {skyvern_base} (API key set).")
        skyvern = Skyvern(base_url=skyvern_base, api_key=skyvern_api_key)

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

    log(f"Backfill range: {cfg.start} .. {cfg.end} (slot={cfg.slot_key}, freeze={cfg.freeze}, dry_run={cfg.dry_run}, verbose={cfg.verbose})")

    for date_key in iter_date_keys(cfg.start, cfg.end):
        log(f"=== {date_key}: running Skyvern tasks ===")
        sales_by_agent = await run_policyden_task(skyvern, date_key, cfg.verbose)
        calls_by_agent, marketing_by_agent, campaign_marketing = await run_wegenerate_task(
            skyvern, date_key, cfg.verbose
        )

        if not sales_by_agent and not calls_by_agent:
            log(f"  {date_key}: both tasks returned no data; skipping snapshot write.")
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
            log(f"  {date_key}: no snapshot rows (check agent_map and active agents).")
            continue

        merged = merge_snapshots(snapshots, new_rows, date_key, cfg.slot_key)

        if cfg.dry_run:
            log(f"  {date_key}: [dry-run] would push {len(new_rows)} snapshots.")
            if campaign_marketing is not None:
                log(f"  {date_key}: [dry-run] would set house marketing to ${campaign_marketing:,.2f}.")
            snapshots = merged
            continue

        if not api_put_snapshots(session, api_base, merged):
            log(f"  {date_key}: PUT /state/snapshots failed.")
            continue
        snapshots = merged
        log(f"  {date_key}: pushed {len(new_rows)} snapshots for slot {cfg.slot_key}.")

        if campaign_marketing is not None:
            if api_set_house_marketing(session, api_base, date_key, campaign_marketing):
                log(f"  {date_key}: set house marketing ${campaign_marketing:,.2f}.")
            else:
                log(f"  {date_key}: failed to set house marketing.")

    if cfg.freeze and not cfg.dry_run:
        start_key = cfg.start.strftime("%Y-%m-%d")
        end_key = cfg.end.strftime("%Y-%m-%d")
        rc = run_freeze_backfill(start_key, end_key)
        if rc != 0:
            log("freeze_eod backfill exited with non-zero status.")
            return rc

    log("Backfill complete.")
    return 0


def main() -> int:
    try:
        return asyncio.run(main_async())
    except KeyboardInterrupt:
        log("Backfill interrupted (Ctrl+C).")
        return 130


if __name__ == "__main__":
    sys.exit(main())
