# Intra-day bot: session capture and scraper

This bot scrapes PolicyDen (sales) and WeGenerate (calls + per-agent marketing), merges by agent, and pushes snapshots to the VC Dash API. The dashboard **Agent Performance** card shows data from the latest snapshot per agent (no manual intra-day entry; the intra-performance alert has been removed). When WeGenerate per-agent marketing is unavailable for a run, existing marketing values for that slot are preserved and the dashboard falls back to a fixed cost-per-call assumption only where marketing is missing.

### Cron summary

- **Intra-day:** `main.py` every 5 minutes (9 AM–9 PM EST, Mon–Fri). **EOD:** `eod.py` at 9:15 PM EST (runs main then freezes today). **Daily:** `policies_bot.py` once at 9 AM EST (optional; audit sync).

### Script reference (quick reference)

- **eod.py** — EOD script: with no arguments, runs `main.py` (with one retry on failure) then freezes today’s snapshots into `perf_history`. Run daily at 9:15 PM via cron. Also supports `--date YYYY-MM-DD`, `--backfill-all`, `--backfill-range START END`, and `--set-marketing [--date YYYY-MM-DD] [--amount N]` to correct house marketing by scaling existing `perf_history`.
- **http_retry.py** — Shared helper: HTTP requests with retries on `ChunkedEncodingError` / connection / timeout. Used by main.py, eod.py, and policies_bot.py when calling the API.
- **run_backfill_all.sh** — On the VPS, runs `eod.py --backfill-all` only (no git pull). Use after copying updated bot files to backfill all past dates that have snapshots but no `perf_history`.

## 1. capture.py (run locally on your Mac)

Captures your browser session for PolicyDen and WeGenerate so the VPS can reuse it.

**Setup (once):**
```bash
pip install playwright   # or: python3 -m pip install playwright
playwright install chromium   # or: python3 -m playwright install chromium
```

**Run:**
```bash
cd bot
python3 capture.py policyden    # → auth_policyden.json
python3 capture.py wegenerate   # → auth_wegenerate.json
```

Upload both `auth_*.json` files to your VPS at `~/bot/`. Re-run when sessions expire.

---

## 2. VPS setup (Oracle / any Linux)

**Install dependencies (use a venv so pip works on modern Linux):**
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv python3-full
cd ~/bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m playwright install-deps chromium
python -m playwright install chromium
deactivate
```
After this, always use `~/bot/venv/bin/python` (or activate the venv) when running the bot.

**Project folder:**
```bash
mkdir -p ~/bot && cd ~/bot
```

**Upload these files into `~/bot/`:**
- `auth_policyden.json` (from capture.py)
- `auth_wegenerate.json` (from capture.py)
- `auth_login.py` (from this repo; used for auto re-login when sessions expire)
- `main.py` (from this repo)
- `eod.py` (from this repo; for 9:15 PM EOD: runs main then freezes today)
- `policies_bot.py` (from this repo; optional — see below)
- `requirements.txt` (from this repo)

**Create `.env`:**
```bash
API_BASE_URL=https://your-railway-app.up.railway.app
ADMIN_USERNAME=your-dashboard-username
ADMIN_PASSWORD=your-dashboard-password
# Optional: get notified when PolicyDen/WeGenerate sessions expire
TELEGRAM_BOT_TOKEN=your-bot-token-from-BotFather
TELEGRAM_CHAT_ID=your-chat-id
# Optional: auto re-login when sessions expire (no need to run refresh.sh / capture.py for expiry)
POLICYDEN_USERNAME=your-policyden-email
POLICYDEN_PASSWORD=your-policyden-password
WEGENERATE_USERNAME=your-wegenerate-email
WEGENERATE_PASSWORD=your-wegenerate-password
```

To get these: create a bot with [@BotFather](https://t.me/BotFather), then send any message to your bot and open `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your `chat_id` (under `message.chat.id`). If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is missing, the bot will still run but won't send session-expiry alerts.

If you set `POLICYDEN_USERNAME`/`POLICYDEN_PASSWORD` and `WEGENERATE_USERNAME`/`WEGENERATE_PASSWORD`, the bot will automatically re-login when it detects an expired session (login page), save the new session to the auth files, and retry the scrape. You then don't need to re-run `capture.py` or `refresh.sh` just for session expiry. If a site uses 2FA or CAPTCHA on login, automatic login will fail and you'll still need to use `capture.py` and upload the auth files for that site.

**Create `agent_map.json`:**  
Copy `agent_map.example.json` to `agent_map.json` and fill in the mapping from agent names (as shown in PolicyDen/WeGenerate) to dashboard agent IDs (from your app’s Agents / GET /state → agents).

```json
{
  "John Smith": "agent-uuid-from-dashboard",
  "Jane Doe": "another-agent-uuid"
}
```

**Configure selectors (required for scraping):**  
Edit `main.py` and set the selector constants near the top. If a site is redesigned, selectors can break (e.g. "Date picker failed" or empty scraped data). Then:

- **WeGenerate:** The date control may no longer be `button#date`. In Chrome DevTools on the WeGenerate dashboard, inspect the date picker button and note its selector (id, data-testid, aria-label, or class). Set `SELECTORS_WEGENERATE["date_trigger"]` to that selector. The bot also tries fallback selectors; add more in `date_trigger_fallbacks` if needed.
- **PolicyDen:** Ensure `open_live_view`, `table_rows`, `col_agent`, `col_sales` match the live view table.

Use browser DevTools on PolicyDen and WeGenerate to find the right selectors and column indices (0-based).

**Test run:**
```bash
cd ~/bot
./venv/bin/python main.py
```

**Cron (every 5 minutes, Mon–Fri):** Use the venv Python so all dependencies are available. The bot skips scraping outside 9 AM–9 PM EST and on weekends (exits immediately to save memory); it only runs the browser 9 AM–9 PM EST Monday–Friday.
```bash
crontab -e
```
Add (replace `ubuntu` with your username if different):
```
CRON_TZ=America/New_York
*/5 9-21 * * 1-5 cd /home/ubuntu/bot && /home/ubuntu/bot/venv/bin/python main.py >> /home/ubuntu/bot/bot.log 2>&1
```
The bot also exits without scraping if run before 9 AM EST, after 9 PM EST, or on Saturday/Sunday.

**Cron (EOD at 9:15 PM EST, Mon–Fri):** At 9:15 PM, `eod.py` runs `main.py` (with one retry on failure) then freezes today’s snapshots so EOD and weekly totals use that final data. Uses the same `.env` as the bot. Add this line in `crontab -e`:
```
15 21 * * 1-5 cd /home/ubuntu/bot && /home/ubuntu/bot/venv/bin/python eod.py >> /home/ubuntu/bot/freeze.log 2>&1
```
If you already have other cron jobs, add only the `15 21` line and ensure `CRON_TZ=America/New_York` is set once at the top of the crontab if you want EST/EDT. Monitor: `tail -f ~/bot/freeze.log`

**EOD backfill (perf_history for past dates):** If you have snapshots for past days but no perf_history (e.g. before the EOD cron was set up), run once to backfill as far as possible:
```bash
cd ~/bot
./venv/bin/python eod.py --backfill-all
```
**Update bot on VPS then backfill:** If the bot code lives in a git clone on the VPS (e.g. `~/vc_dash`), from the repo root run `./scripts/vps-update-and-backfill.sh` to pull and run backfill. If you only copy the `bot/` folder to the VPS, after copying updated files run `cd ~/bot && ./run_backfill_all.sh`.
To backfill only a date range (START and END inclusive, YYYY-MM-DD):
```bash
./venv/bin/python eod.py --backfill-range 2025-03-01 2025-03-07
```
Single-date backfill: `./venv/bin/python eod.py --date 2025-03-02`

**Set EOD marketing total (corrective):** If a freeze used the wrong house marketing number, scale existing `perf_history` for a date to the correct total: `./venv/bin/python eod.py --set-marketing [--date YYYY-MM-DD] [--amount 4354]` (default date: yesterday EST).

**Monitor:** `tail -f ~/bot/bot.log`

---

## 3. Backfill EOD from PolicyDen/WeGenerate (historical performance)

**Primary backfill:** `backfill.py` — uses the same scrapers as `main.py`, runs headless, supports `--freeze`. For a headed run where you can watch the browser, use `backfill_headed.py` (self-contained, same date range and `--freeze` options).

If you want to backfill **daily performance (EOD)** for past dates using real scraped data (PolicyDen sales + WeGenerate calls/marketing), use `backfill.py`. This script:

- Loops a date range (start..end).
- For each date, re-runs the same scrapers as `main.py` (PolicyDen + WeGenerate) for that date.
- Writes/overwrites `snapshots` for that `(dateKey, slot)` and sets `houseMarketing` from WeGenerate campaign marketing (when available).
- Optionally calls `eod.py --backfill-range` so `perf_history` and house EOD metrics are populated for that range.

> Note: PolicyDen scraping uses **Open Live View** (today) and currently does not change the date in the UI. For dates where PolicyDen’s live view does not show the historical day you care about, sales may not backfill perfectly. WeGenerate supports date selection via the date picker and will backfill calls/marketing for the chosen date.

**Usage (run on VPS in `~/bot`):**

```bash
cd ~/bot

# Backfill from START up to yesterday (EST), default slot=17:00 (5 PM EOD)
./venv/bin/python backfill.py --start 2025-03-01

# Backfill an explicit date range (inclusive)
./venv/bin/python backfill.py --start 2025-03-01 --end 2025-03-07

# Backfill and immediately freeze perf_history for that range
./venv/bin/python backfill.py --start 2025-03-01 --end 2025-03-07 --slot 17:00 --freeze

# Dry run (scrape + log only, no writes)
./venv/bin/python backfill.py --start 2025-03-01 --end 2025-03-07 --dry-run
```

Flags:

- `--start YYYY-MM-DD` (required): first date to backfill.
- `--end YYYY-MM-DD` (optional): last date to backfill (inclusive). Defaults to **yesterday in EST** if omitted.
- `--slot HH:MM` (optional): slot key used when writing snapshots (must match a `SLOT_CONFIG` key in `main.py`; default `17:00`).
- `--freeze` (optional): after writing snapshots for the range, runs `eod.py --backfill-range START END` so `perf_history` and house marketing totals are populated. This drives the EOD “Vault” history and weekly views in the Tasks page.
- `--dry-run` (optional): do everything except the actual `PUT /state/snapshots` and `POST /state/house-marketing` calls.

Once the script runs (with `--freeze`), you’ll see:

- Per-agent daily performance filled in the **EOD Report History (Vault)** on the Tasks page via `perf_history`.
- House-level sales/CPA for those days in the EOD history and weekly summaries (sourced from `perf_history` + house marketing).
- EOD narrative text (`eod_reports`) remains manual unless you choose to backfill it separately.

## 4. Policies bot (Action Needed Audit sync)

`policies_bot.py` scrapes PolicyDen **Policies** for the current month (date range “This Month” only; no status filter), then syncs **audit records** with the dashboard: it **adds** records only for policies with status Pending CMS or Flagged, and **updates** existing records when PolicyDen status changes to accepted, issued, or placed so the website reflects the change. Uses the same `auth_policyden.json` and `agent_map.json` as the main bot.

**Run (same .env and agent_map as main bot):**
```bash
cd ~/bot
./venv/bin/python policies_bot.py
```

The dashboard **Last parsed** column (Tasks → Action Needed Audit, Vault → Action Needed History) shows the last date the policies bot ran. It shows **Never** until the bot has run at least once and successfully called the API; ensure `API_BASE_URL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` match the dashboard. If the bot exits with "Failed to set last policies bot run timestamp", fix credentials or API URL and re-run.

**Optional cron (once per day at 9 AM EST):** Add to `crontab -e` (replace `ubuntu` with your username):
```
CRON_TZ=America/New_York
0 9 * * * cd /home/ubuntu/bot && /home/ubuntu/bot/venv/bin/python policies_bot.py >> /home/ubuntu/bot/policies_bot.log 2>&1
```

If the PolicyDen Policies table layout changes (column order or selectors), edit the constants at the top of `policies_bot.py` (`COL_CONTACT`, `COL_STATUS`, `COL_CARRIER`, `COL_AGENT`) and the table row selector. Carriers are normalized to Aetna, UHC, Humana (Careplus → Humana).

---

## Troubleshooting: dashboard not showing correct data

- **Same API URL for bot and dashboard**  
  The dashboard uses `VITE_API_URL` set at **build time** (e.g. in Cloudflare Pages). The bot uses `API_BASE_URL` in `.env` on the VPS. These must be the **exact same** Railway API URL. If the frontend was built with a different or old URL, it will never see the data the bot pushes. In Cloudflare Pages (or your frontend host), set `VITE_API_URL=https://your-railway-app.up.railway.app` (same as bot `API_BASE_URL`), then **rebuild and redeploy** the frontend.

- **Refresh delay**  
  The dashboard refetches from the API every 5 minutes. After the bot runs, use **Reload** (in the app nav) to fetch the latest snapshots immediately.

- **Agent names must match exactly**  
  Each key in `agent_map.json` must match the name exactly as it appears in the PolicyDen and WeGenerate tables (same spelling, spaces, punctuation). If a name doesn’t match, that agent’s calls/sales will be 0. Check `bot.log` for `Pushed N snapshots for YYYY-MM-DD HH:MM` to confirm the bot is pushing; then compare dashboard agent names with the names in the scraped tools.

- **Only mapped agents get data**  
  The bot only pushes rows for agents that are in `agent_map.json` and **active** in the dashboard. Agents missing from the map will show 0 calls/sales for today.

- **See exactly what the bot scraped and pushed**  
  Run with verbose logging and compare names/numbers to the dashboard and source tools:
  ```bash
  BOT_VERBOSE=1 ./venv/bin/python main.py
  ```
  The log will show: PolicyDen name→sales, WeGenerate name→calls, your `agent_map` keys, and each row pushed (display name, sales, calls). If a name in `agent_map` doesn’t appear in the scraped lists or has 0 there, fix the name in `agent_map` (or the selectors) so it matches exactly what appears in the table.

- **"Date picker failed" or both scrapers return 0**  
  The site’s UI likely changed. Open the dashboard in a browser, use DevTools to find the date control and table selectors, and update `SELECTORS_WEGENERATE` (and `SELECTORS_POLICYDEN` if needed) in `main.py` (see **Configure selectors** above).

- **Both PolicyDen and WeGenerate return {}**  
  Saved sessions often expire. If you have set `POLICYDEN_USERNAME`/`POLICYDEN_PASSWORD` and `WEGENERATE_USERNAME`/`WEGENERATE_PASSWORD` in `.env` on the VPS, the bot will automatically re-login when it detects an expired session and retry the scrape. Otherwise, re-run `capture.py` for both sites (on your Mac), then re-upload the new `auth_policyden.json` and `auth_wegenerate.json` to the VPS with `scp`. Without valid auth, the dashboards show a login page and the bot sees no table rows. If you set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`, the bot will send you a Telegram message when it detects expired sessions (either or both sites).
