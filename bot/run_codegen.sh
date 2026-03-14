#!/usr/bin/env bash
# Run Playwright codegen to record UI steps for PolicyDen and WeGenerate.
# See CODEGEN.md for what to do in the browser. Output: codegen_policyden.py, codegen_wegenerate.py.

set -e
cd "$(dirname "$0")"

echo "=== PolicyDen: record login, dashboard, date picker, Open Live View, table ==="
python3 -m playwright codegen --save-storage=auth_policyden.json -o codegen_policyden.py https://app.policyden.com/login

echo ""
echo "=== WeGenerate: record login, dashboard, date picker, Agent Performance table ==="
python3 -m playwright codegen --save-storage=auth_wegenerate.json -o codegen_wegenerate.py https://app.wegenerate.com/login

echo ""
echo "Done. See CODEGEN.md for steps to perform in each browser session."
