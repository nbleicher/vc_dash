# Intra-day bot: session capture and scraper

This bot scrapes PolicyDen (sales) and WeGenerate (calls), merges by agent, and pushes snapshots to the VC Dash API. The dashboard **Agent Performance** card shows data from the latest snapshot per agent (no manual intra-day entry; the intra-performance alert has been removed).

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
- `bot.py` (from this repo)
- `policies_bot.py` (from this repo; optional — see below)
- `freeze_eod.py` (from this repo; for 11:50 PM EOD freeze cron)
- `populate_6pm_house.py` (from this repo; for 6:00 PM house CPA/sales snapshot cron)
- `requirements.txt` (from this repo)

**Create `.env`:**
```bash
API_BASE_URL=https://your-railway-app.up.railway.app
ADMIN_USERNAME=your-dashboard-username
ADMIN_PASSWORD=your-dashboard-password
# Optional: get notified when PolicyDen/WeGenerate sessions expire
TELEGRAM_BOT_TOKEN=your-bot-token-from-BotFather
TELEGRAM_CHAT_ID=your-chat-id
```
To get these: create a bot with [@BotFather](https://t.me/BotFather), then send any message to your bot and open `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your `chat_id` (under `message.chat.id`). If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is missing, the bot will still run but won’t send session-expiry alerts.

**Create `agent_map.json`:**  
Copy `agent_map.example.json` to `agent_map.json` and fill in the mapping from agent names (as shown in PolicyDen/WeGenerate) to dashboard agent IDs (from your app’s Agents / GET /state → agents).

```json
{
  "John Smith": "agent-uuid-from-dashboard",
  "Jane Doe": "another-agent-uuid"
}
```

**Configure selectors (required for scraping):**  
Edit `bot.py` and set the selector constants near the top. If a site is redesigned, selectors can break (e.g. "Date picker failed" or empty scraped data). Then:

- **WeGenerate:** The date control may no longer be `button#date`. In Chrome DevTools on the WeGenerate dashboard, inspect the date picker button and note its selector (id, data-testid, aria-label, or class). Set `SELECTORS_WEGENERATE["date_trigger"]` to that selector. The bot also tries fallback selectors; add more in `date_trigger_fallbacks` if needed.
- **PolicyDen:** Ensure `open_live_view`, `table_rows`, `col_agent`, `col_sales` match the live view table.

Use browser DevTools on PolicyDen and WeGenerate to find the right selectors and column indices (0-based).

**Test run:**
```bash
cd ~/bot
./venv/bin/python bot.py
```

**Cron (every 10 minutes):** Use the venv Python so all dependencies are available. The bot skips scraping between 12:01 AM and 8:59 AM EST (exits immediately to save memory); it only runs the browser during 9 AM–midnight EST.
```bash
crontab -e
```
Add (replace `ubuntu` with your username if different):
```
*/10 * * * * cd /home/ubuntu/bot && /home/ubuntu/bot/venv/bin/python bot.py >> /home/ubuntu/bot/bot.log 2>&1
```
To avoid launching the bot at all between 1–8 AM EST (saves cron + Python startup), you can use `*/10 9-23 * * *` instead of `*/10 * * * *` (and set `CRON_TZ=America/New_York`). The bot also exits without scraping if run between 12:01–8:59 AM EST.

**Cron (EOD freeze at 11:50 PM EST):** So the day’s snapshots are saved to perfHistory even when the dashboard is closed. Uses the same `.env` as the bot. Add this line in `crontab -e` (use your timezone; example is 11:50 PM America/New_York):
```
CRON_TZ=America/New_York
50 23 * * * cd /home/ubuntu/bot && /home/ubuntu/bot/venv/bin/python freeze_eod.py >> /home/ubuntu/bot/freeze.log 2>&1
```
If you already have other cron jobs, add only the `50 23` line and ensure `CRON_TZ=America/New_York` is set once at the top of the crontab if you want EST/EDT. Monitor: `tail -f ~/bot/freeze.log`

**Cron (6:00 PM EST — populate house CPA and sales):** Saves that day’s house sales and CPA into vault so the EOD Report task can show “6 PM” values. Add to `crontab -e`:
```
0 18 * * * cd /home/ubuntu/bot && /home/ubuntu/bot/venv/bin/python populate_6pm_house.py >> /home/ubuntu/bot/populate_6pm.log 2>&1
```
Monitor: `tail -f ~/bot/populate_6pm.log`

**Monitor:** `tail -f ~/bot/bot.log`

---

## 3. Policies bot (Action Needed Audit sync)

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
  The dashboard refetches from the API every 10 minutes. After the bot runs, use **Reload** (in the app nav) to fetch the latest snapshots immediately.

- **Agent names must match exactly**  
  Each key in `agent_map.json` must match the name exactly as it appears in the PolicyDen and WeGenerate tables (same spelling, spaces, punctuation). If a name doesn’t match, that agent’s calls/sales will be 0. Check `bot.log` for `Pushed N snapshots for YYYY-MM-DD HH:MM` to confirm the bot is pushing; then compare dashboard agent names with the names in the scraped tools.

- **Only mapped agents get data**  
  The bot only pushes rows for agents that are in `agent_map.json` and **active** in the dashboard. Agents missing from the map will show 0 calls/sales for today.

- **See exactly what the bot scraped and pushed**  
  Run with verbose logging and compare names/numbers to the dashboard and source tools:
  ```bash
  BOT_VERBOSE=1 ./venv/bin/python bot.py
  ```
  The log will show: PolicyDen name→sales, WeGenerate name→calls, your `agent_map` keys, and each row pushed (display name, sales, calls). If a name in `agent_map` doesn’t appear in the scraped lists or has 0 there, fix the name in `agent_map` (or the selectors) so it matches exactly what appears in the table.

- **"Date picker failed" or both scrapers return 0**  
  The site’s UI likely changed. Open the dashboard in a browser, use DevTools to find the date control and table selectors, and update `SELECTORS_WEGENERATE` (and `SELECTORS_POLICYDEN` if needed) in `bot.py` (see **Configure selectors** above).

- **Both PolicyDen and WeGenerate return {}**  
  Saved sessions often expire. Re-run `capture.py` for both sites (on your Mac), then re-upload the new `auth_policyden.json` and `auth_wegenerate.json` to the VPS with `scp`. Without valid auth, the dashboards show a login page and the bot sees no table rows. If you set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`, the bot will send you a Telegram message when it detects expired sessions (either or both sites).
