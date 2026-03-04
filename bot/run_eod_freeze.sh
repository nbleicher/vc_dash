#!/usr/bin/env bash
# EOD at 9:15 PM: pull marketing (and sales/calls) one last time, then freeze today's snapshots.
# Run from cron: 15 21 * * 1-5 cd /home/ubuntu/bot && ./run_eod_freeze.sh >> /home/ubuntu/bot/freeze.log 2>&1
set -e
cd "$(dirname "$0")"

echo "[$(date -Iseconds)] EOD: running bot..."
./venv/bin/python bot.py || bot_exit=$?
if [ -n "${bot_exit:-}" ] && [ "$bot_exit" -ne 0 ]; then
  echo "[$(date -Iseconds)] EOD: bot exited ${bot_exit}; retrying once in 60s..."
  sleep 60
  ./venv/bin/python bot.py || true
fi

echo "[$(date -Iseconds)] EOD: running freeze..."
./venv/bin/python freeze_eod.py
