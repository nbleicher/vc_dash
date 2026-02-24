# Intra-day bot: session capture and scraper

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
Edit `bot.py` and set the selector constants near the top:

- **SELECTORS_POLICYDEN**: `date_trigger`, `date_apply`, `table_rows`, `col_agent` (column index for agent name), `col_contact` (column index for contact name = policy_id).
- **SELECTORS_WEGENERATE**: `date_trigger`, `date_apply`, `table_rows`, `col_agent`, `col_calls` (column index for billable calls).

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
