# Codegen for backfill UI steps

Use Playwright codegen to **record** the exact UI steps for PolicyDen and WeGenerate. The generated scripts are the reference for what the backfill bot does; when the sites change, re-run codegen and update `backfill_watch.py` to match.

**Quick run:** From `bot/` run `./run_codegen.sh` to launch codegen for both sites in sequence (do the steps in each browser window, then the next will start). If you use a venv, run `./venv/bin/python -m playwright codegen ...` or activate the venv first.

## PolicyDen

From the `bot/` directory (use `python3` or your venv Python if `python` is not available):

```bash
python3 -m playwright codegen --save-storage=auth_policyden.json -o codegen_policyden.py https://app.policyden.com/login
```

In the opened browser:

1. Log in.
2. Go to the dashboard.
3. Open the date picker (button#date), pick a day, click Apply.
4. Click **Open Live View** and wait until the leaderboard table is visible.
5. Stop recording (close the codegen window or press Stop).

Output: `bot/codegen_policyden.py` and optionally `auth_policyden.json`. Use the generated script to see selectors and step order for the PolicyDen flow in `backfill_watch.py`.

## WeGenerate

```bash
python3 -m playwright codegen --save-storage=auth_wegenerate.json -o codegen_wegenerate.py https://app.wegenerate.com/login
```

In the browser:

1. Log in.
2. Go to the dashboard.
3. Open the date picker, select a date, click Apply.
4. Wait for the **Agent Performance** table (and campaign marketing section if visible).
5. Stop recording.

Output: `bot/codegen_wegenerate.py` and optionally `auth_wegenerate.json`. Use this for the WeGenerate flow in `backfill_watch.py`.

## After recording

- Keep `codegen_*.py` in the repo as the reference for “everything that needs to be done” on the UI.
- When the sites change, re-run codegen and update `backfill_watch.py` (selectors and step order) to match the new output.
