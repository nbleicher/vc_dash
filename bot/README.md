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
- `requirements.txt` (from this repo)

**Create `.env`:**
```bash
API_BASE_URL=https://your-railway-app.up.railway.app
ADMIN_USERNAME=your-dashboard-username
ADMIN_PASSWORD=your-dashboard-password
```

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

**Cron (every 10 minutes):** Use the venv Python so all dependencies are available.
```bash
crontab -e
```
Add (replace `ubuntu` with your username if different):
```
*/10 * * * * cd /home/ubuntu/bot && /home/ubuntu/bot/venv/bin/python bot.py >> /home/ubuntu/bot/bot.log 2>&1
```

**Monitor:** `tail -f ~/bot/bot.log`

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
  Saved sessions often expire. Re-run `capture.py` for both sites (on your Mac), then re-upload the new `auth_policyden.json` and `auth_wegenerate.json` to the VPS with `scp`. Without valid auth, the dashboards show a login page and the bot sees no table rows.
