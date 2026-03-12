#!/usr/bin/env bash
# Run on the VPS to pull latest code and backfill all EOD perf_history.
# From repo root:  ./scripts/vps-update-and-backfill.sh
# Requires: repo is a git clone, and bot/venv exists.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "[$(date -Iseconds)] Pulling latest..."
git pull origin main
echo "[$(date -Iseconds)] Running backfill-all..."
cd bot
./venv/bin/python freeze_eod.py --backfill-all
echo "[$(date -Iseconds)] Done."
