#!/usr/bin/env bash
# Refresh PolicyDen and WeGenerate auth sessions, then upload to the VPS.
# Override with: export VPS_TARGET=user@host:/path/to/bot

set -e
cd "$(dirname "$0")"
VPS_TARGET="${VPS_TARGET:-ubuntu@150.136.55.88:/home/ubuntu/bot}"

if [[ -d "venv" ]]; then
  source venv/bin/activate
  PY=python
else
  PY=python3
  if ! command -v python3 &>/dev/null; then
    PY=python
  fi
  echo "No venv found; using $PY. Create a venv in bot/ for a controlled environment."
fi

echo "=== PolicyDen ==="
echo "Log in in the browser, then press Enter here to save the session."
$PY capture.py policyden

echo ""
echo "=== WeGenerate ==="
echo "Log in in the browser, then press Enter here to save the session."
$PY capture.py wegenerate

echo ""
echo "Uploading auth files to VPS..."
scp auth_policyden.json auth_wegenerate.json "$VPS_TARGET/"

echo "Done. Auth files updated on VPS."
