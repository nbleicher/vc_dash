#!/usr/bin/env bash
# Run from bot directory on VPS to backfill all EOD perf_history (no git pull).
# After updating bot files:  cd ~/bot && ./run_backfill_all.sh
set -e
cd "$(dirname "$0")"
echo "[$(date -Iseconds)] Running backfill-all..."
./venv/bin/python freeze_eod.py --backfill-all
echo "[$(date -Iseconds)] Done."
