# Skyvern Backfill Bot

This document explains how to use the **Skyvern backfill bot** to populate historical EOD performance and `perf_history` for the VC Dash by scraping PolicyDen (sales) and WeGenerate (calls + marketing) using [Skyvern](https://github.com/Skyvern-AI/skyvern) with a **local OpenClaw** (or other OpenAI-compatible) LLM instance. The bot is intended **only for backfilling** past dates; the intra-day bot (`bot.py`) remains unchanged and continues to handle live snapshots every 5 minutes.

---

## Intended utility

- **Problem**: The Playwright-based backfill (`backfill_eod_from_sources.py`) can fail when site UIs change, especially calendar/date pickers. Backfilling `perf_history` and EOD reports for past dates then becomes unreliable.
- **Solution**: A separate backfill flow that uses Skyvern’s AI-powered browser automation to:
  - Open PolicyDen and WeGenerate,
  - Set the date to each historical day (handling calendar UI via natural language),
  - Extract per-agent sales, calls, and marketing (and campaign marketing) into a normalized structure,
  - Write snapshots and optional house marketing to the VC Dash API using the same merge/write logic as the rest of the bot,
  - Optionally run `freeze_eod.py --backfill-range` so `perf_history` and EOD history are populated for that range.

You run this backfill **manually** (or on a schedule) when you need to backfill or correct historical data. It is **not** used for intra-day scraping.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│  skyvern_backfill_eod.py (orchestrator)                          │
│  - CLI: --start, --end, --slot, --freeze, --dry-run, --verbose   │
│  - For each date: run PolicyDen task + WeGenerate task via       │
│    Skyvern SDK → normalize → merge_snapshots + API writes        │
│  - Optional: run freeze_eod.py --backfill-range at end            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Skyvern server  │  │ VC Dash API     │  │ freeze_eod.py   │
│ (local)         │  │ (Railway)       │  │ (backfill-range) │
│ - run_task()    │  │ PUT snapshots   │  │                  │
│ - uses OpenClaw │  │ POST house-mkt  │  │                  │
└────────┬────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────┐
│ OpenClaw        │  Your local LLM (OpenAI-compatible API)
│ (or other LLM)  │  Skyvern sends prompts + screenshots here.
└─────────────────┘
```

- **Skyvern** runs locally and uses your OpenClaw instance as the LLM. The backfill script supports two modes: **local mode** (`Skyvern.local()` — in-process, no separate server or API key) or **server mode** (connect to `skyvern run server` with `SKYVERN_API_KEY`; see “Getting the Skyvern API key” below).
- **VC Dash API** is the same as for the intra-day bot: `API_BASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` in `.env`.
- **freeze_eod.py** is invoked only when `--freeze` is set and not `--dry-run`; it computes and stores `perf_history` for the backfilled range.

---

## Prerequisites

- **Python 3.11** (or 3.12). Skyvern does not support 3.13 yet.
- **Node.js & npm** (for Skyvern’s stack).
- **OpenClaw** (or any OpenAI-compatible API) running locally and reachable (e.g. `http://localhost:8080/v1` or your OpenClaw base URL).
- **PolicyDen and WeGenerate** accounts. For Skyvern to log in you can either:
  - Use **Chrome with CDP**: your normal Chrome profile so existing logins are reused, or
  - Configure credentials in Skyvern and let it log in (or use Skyvern’s credential storage).

---

## 1. Skyvern installation and local server (with OpenClaw)

### 1.1 Install Skyvern

From the `bot` directory (or a dedicated venv for backfill):

```bash
cd /path/to/vc_dash/bot
pip install skyvern
# Or use a separate venv:
# python3 -m venv venv_skyvern && source venv_skyvern/bin/activate
# pip install -r requirements.txt && pip install skyvern
```

Optional: create `requirements-skyvern.txt` that includes everything needed for the Skyvern backfill (e.g. `skyvern`, plus `requests`, `python-dotenv` and any other deps the script needs from the main bot).

### 1.2 Configure Skyvern LLM (OpenClaw, Grok, or other OpenAI-compatible API)

Skyvern defaults to `OPENAI_GPT4O` if no valid LLM is configured, which causes: **"LLM Provider NOT provided"** / **"You passed model=OPENAI_GPT4O"**. To use your own API (OpenClaw, Grok, etc.), you must **disable the default OpenAI provider** and set **LLM_KEY** to the provider you configure.

In Skyvern’s `.env` (the one created by `skyvern quickstart`, often in `~/.skyvern` or the directory where you run Skyvern):

**Step 1 – Turn off the default OpenAI provider so Skyvern stops using OPENAI_GPT4O:**

```bash
ENABLE_OPENAI=false
```

**Step 2 – Enable and configure the OpenAI-compatible provider (Groq Cloud, OpenClaw, etc.):**

**Groq Cloud** ([console.groq.com](https://console.groq.com/home)) – get your API key from [API Keys](https://console.groq.com/home), then in Skyvern’s `.env`:

```bash
ENABLE_OPENAI_COMPATIBLE=true
LLM_KEY=OPENAI_COMPATIBLE

OPENAI_COMPATIBLE_API_BASE=https://api.groq.com/openai/v1
OPENAI_COMPATIBLE_API_KEY=gsk_your_key_here
OPENAI_COMPATIBLE_MODEL_NAME=llama-4-scout-17b-16e3
OPENAI_COMPATIBLE_SUPPORTS_VISION=true
```

Use your real key from [Groq Cloud Console](https://console.groq.com/home). For vision (screenshots), use a vision-capable model such as `llama-4-scout-17b-16e3`; for text-only you can use e.g. `llama-3.3-70b-versatile` (see [Groq models](https://console.groq.com/docs/models)).

**For OpenClaw (local)** instead of Groq Cloud, use:

```bash
OPENAI_COMPATIBLE_API_BASE=http://localhost:8080/v1
OPENAI_COMPATIBLE_MODEL_NAME=your-model-name-in-openclaw
OPENAI_COMPATIBLE_API_KEY=sk-any
OPENAI_COMPATIBLE_SUPPORTS_VISION=true
```

Replace URLs, model names, and keys as needed. **LLM_KEY=OPENAI_COMPATIBLE** must be set so Skyvern uses this provider instead of OPENAI_GPT4O. Restart Skyvern after editing `.env` (`skyvern stop all` then `skyvern run all` or `skyvern run server`).

### 1.3 (Optional) Use your Chrome profile for existing logins

To reuse existing PolicyDen/WeGenerate logins:

```bash
# Path to Chrome (example: macOS)
export CHROME_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
export BROWSER_TYPE=cdp-connect
```

Then start Chrome with remote debugging so Skyvern can attach (see Skyvern docs). Alternatively, run Skyvern with its default browser and log in once (or use Skyvern credentials).

### 1.4 Start Skyvern

```bash
skyvern quickstart
```

When prompted, choose the option that fits (e.g. local PostgreSQL via Docker, or your own DB). Then start the server and UI:

```bash
skyvern run all
```

Or run only the server (no UI) if you are driving everything from the backfill script:

```bash
skyvern run server
```

**Skyvern API key is off by default.** The script uses local mode (`Skyvern.local()`) unless you set `SKYVERN_API_KEY`.

- **Local mode (default, no API key):** Do **not** set `SKYVERN_API_KEY`. The script uses `Skyvern.local()` (in-process). No separate `skyvern run server` or API key is required; run `skyvern quickstart` once so Skyvern’s `.env` and DB exist. To force local mode even when an API key is set, set `SKYVERN_USE_LOCAL=1` in your `.env`.
- **Server mode:** Run `skyvern run server` in a separate terminal and set `SKYVERN_API_KEY` in your bot `.env` to the JWT from the Skyvern database (see below); the script will then connect to that server.

### 1.5 Getting the Skyvern API key (server mode only)

Only needed if you run a separate Skyvern server (`skyvern run server`) and want the script to connect to it. The server expects a **JWT API key** on every request. If you get **403 “Could not validate credentials”** or **JWT “Not enough segments”**, use local mode (omit `SKYVERN_API_KEY`) or set the real token.

After `skyvern quickstart` has created the database, get the token from PostgreSQL:

```bash
# If Skyvern uses Docker Postgres (default):
docker exec -it <skyvern-postgres-container> psql -U skyvern -d skyvern -c "SELECT token FROM organization_auth_tokens LIMIT 1;"

# Or if you run Postgres directly:
psql -U skyvern -h localhost -d skyvern -c "SELECT token FROM organization_auth_tokens LIMIT 1;"
```

Copy the `token` value (a long JWT string). In your **bot** `.env`:

```bash
SKYVERN_BASE_URL=http://localhost:8000
SKYVERN_API_KEY=<paste-the-token-here>
```

Do **not** use a placeholder like `sk-any`; it must be the real JWT. To avoid server/auth entirely, leave `SKYVERN_API_KEY` unset and use local mode.

### 1.6 Verify with a simple task

**Local mode (no API key):**

```bash
cd /path/to/vc_dash/bot
python -c "
import asyncio
from skyvern import Skyvern
async def test():
    s = Skyvern.local()
    t = await s.run_task(url='https://example.com', prompt='What is the main heading on this page?', wait_for_completion=True)
    print(t)
asyncio.run(test())
"
```

**Server mode (with API key in .env):** Use the same snippet but with `Skyvern(base_url=..., api_key=...)` and ensure `skyvern run server` is running. If you see 403, use local mode or set the real JWT.

---

## 2. VC Dash and bot configuration

The backfill script uses the **same** `.env` and `agent_map.json` as the rest of the bot (same as `backfill_eod_from_sources.py`).

### 2.1 Required `.env` variables

In `bot/.env`:

- `API_BASE_URL` – your VC Dash API (e.g. Railway).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` – dashboard login for the API.

No PolicyDen/WeGenerate credentials are required in `.env` for the Skyvern backfill **if** you use Chrome CDP with an already-logged-in profile. If Skyvern logs in by itself, configure credentials in Skyvern (or pass them in the task context if supported).

### 2.2 agent_map.json

Same as the intra-day bot: keys are display names as shown in PolicyDen/WeGenerate, values are dashboard agent UUIDs from GET `/state` → `agents`. The backfill script only pushes snapshots for agents in this map and only for agents that are active in the dashboard.

---

## 3. Running the Skyvern backfill

### 3.1 Command-line interface

From the `bot` directory, with the venv that has `skyvern` and the bot dependencies activated:

```bash
# Backfill from a start date through yesterday (EST)
./venv/bin/python skyvern_backfill_eod.py --start 2025-03-01

# Backfill an explicit date range (inclusive)
./venv/bin/python skyvern_backfill_eod.py --start 2025-03-01 --end 2025-03-07

# Use a specific slot (default 17:00)
./venv/bin/python skyvern_backfill_eod.py --start 2025-03-01 --slot 17:00

# After writing snapshots, run freeze_eod.py --backfill-range for perf_history and EOD
./venv/bin/python skyvern_backfill_eod.py --start 2025-03-01 --end 2025-03-07 --freeze

# Dry-run: run Skyvern tasks and log what would be written, but do not call the API or freeze
./venv/bin/python skyvern_backfill_eod.py --start 2025-03-01 --end 2025-03-03 --dry-run

# Verbose: print normalized tables and extra debug info
./venv/bin/python skyvern_backfill_eod.py --start 2025-03-01 --end 2025-03-02 --verbose
```

### 3.2 Flags summary

| Flag        | Description |
|------------|-------------|
| `--start`  | Start date (YYYY-MM-DD), required. |
| `--end`    | End date (YYYY-MM-DD), inclusive. Default: yesterday in EST. |
| `--slot`   | Slot key for snapshots (default `17:00`). Must exist in `SLOT_CONFIG` in `bot.py`. |
| `--freeze` | After the range, run `freeze_eod.py --backfill-range START END` to populate `perf_history` and EOD. |
| `--dry-run`| Do not PUT snapshots or POST house marketing; do not run freeze. Still runs Skyvern tasks and logs what would be written. |
| `--verbose`| Log extracted tables and extra detail for debugging. |

### 3.3 Recommended workflow

1. **Dry-run a short range** to confirm Skyvern can set dates and extract data:
   ```bash
   ./venv/bin/python skyvern_backfill_eod.py --start 2025-03-01 --end 2025-03-02 --dry-run --verbose
   ```
2. Check logs: you should see PolicyDen and WeGenerate extractions and the snapshot rows that would be pushed.
3. **Run without dry-run** for that range (optionally with `--freeze`):
   ```bash
   ./venv/bin/python skyvern_backfill_eod.py --start 2025-03-01 --end 2025-03-02 --freeze
   ```
4. In the dashboard, confirm **EOD Report History (Vault)** and Agent Performance for those dates.
5. Then run the full backfill range you need (with or without `--freeze`).

---

## 4. What the script does per date

For each date in `[start, end]`:

1. **PolicyDen task**: Skyvern is asked to go to the PolicyDen dashboard, set the date to that day, open Live View if needed, and extract a table of agents and sales. The script normalizes this to `sales_by_agent: dict[str, int]`.
2. **WeGenerate task**: Skyvern is asked to go to the WeGenerate dashboard, set the date to that day, and extract the Agent Performance table (agent, billable calls, marketing) plus the campaign-level marketing total. The script normalizes to `calls_by_agent`, `marketing_by_agent`, and `campaign_marketing`.
3. If both extractions are empty, the script logs and skips that date (no snapshot write).
4. Otherwise it builds snapshot rows (same shape as the Playwright backfill) using `agent_map.json` and active agents from the API, merges with existing snapshots, and:
   - **If not dry-run**: PUTs snapshots and, if WeGenerate returned campaign marketing, POSTs house marketing for that date.
5. After all dates, if `--freeze` and not `--dry-run`, the script runs `freeze_eod.py --backfill-range START END` so `perf_history` and EOD are updated for the whole range.

---

## 5. Troubleshooting

- **"LLM Provider NOT provided" / "You passed model=OPENAI_GPT4O"**: Skyvern is still using the default OpenAI provider. In Skyvern’s `.env` set `ENABLE_OPENAI=false`, set `LLM_KEY=OPENAI_COMPATIBLE`, and configure `OPENAI_COMPATIBLE_*` for Grok or OpenClaw (see section 1.2). Restart Skyvern after changing `.env`.
- **Skyvern server not running**: Start it with `skyvern run server` or `skyvern run all` before running the backfill script.
- **OpenClaw / Grok connection**: Ensure `OPENAI_COMPATIBLE_API_BASE` and model name match your API; use `--verbose` and check Skyvern logs.
- **Login / session**: If you see login pages instead of data, use Chrome CDP with a logged-in profile or configure Skyvern credentials for PolicyDen/WeGenerate.
- **Wrong or empty data**: Use `--dry-run --verbose` and inspect the extracted tables; adjust Skyvern task prompts or extraction schema in the script if the sites’ UI has changed.
- **API errors**: Confirm `API_BASE_URL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in `bot/.env`; the script uses the same `api_login`, `api_put_snapshots`, and `api_set_house_marketing` helpers as the rest of the bot.

---

## 6. Relation to other bots

| Component | Role |
|----------|------|
| **bot.py** | Intra-day: runs every 5 min (cron), Playwright-only, today’s date only. No Skyvern. |
| **backfill_eod_from_sources.py** | Playwright backfill for historical dates; can break when calendar/selectors change. |
| **skyvern_backfill_eod.py** | Skyvern-only backfill: uses AI to set dates and extract tables; same API and freeze flow as above. |
| **freeze_eod.py** | Computes and stores `perf_history` and EOD; used by both backfill scripts when `--freeze` is set. |

Use the Skyvern backfill when the Playwright backfill is unreliable (e.g. calendar issues); keep using the intra-day bot for live data.
