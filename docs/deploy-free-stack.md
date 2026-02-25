# Deploy Free Stack (Cloudflare Pages + Railway + Supabase)

## 1) Provision Supabase Postgres (free)

1. Create a new Supabase project.
2. Run SQL migration from `supabase/migrations/20260214_app_state.sql`.
3. Copy the pooled Postgres `DATABASE_URL`.

## 2) Deploy backend API to Railway

1. Create a Railway project and connect this repository.
2. Create one service for this backend and use:
   - Build command: `rm -rf node_modules && npm ci --include=dev`
   - Start command: `npm run server:start`
3. Configure Railway variables:
   - `API_HOST=0.0.0.0`
   - `DATABASE_URL` (Supabase)
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `FRONTEND_ORIGIN` (Cloudflare Pages domain)
4. Keep `API_PORT` optional. The app now supports Railway `PORT` with `API_PORT` fallback.
5. Configure health check path to `/health`.
6. Confirm `GET /health` returns `{ data: { ok: true, db: "ok" } }`.

If Railway build fails with `EBUSY ... rmdir '/app/node_modules/.vite'`:

- Confirm `.dockerignore` includes `node_modules` and `dist`.
- In Railway, clear build cache and redeploy.
- Ensure `nixpacks.toml` is present so Railway does not fall back to default `npm ci`.
- If needed, set build command to `npm install --include=dev --no-audit --no-fund`.

### Railway not auto-deploying / not seeing GitHub updates

1. **Trigger a deploy now:** In the Railway dashboard, open your project → your service → **Deployments**. Click **Deploy** (or the **⋯** menu on the latest deployment → **Redeploy**). That uses the latest commit from the connected branch without waiting for a new push.
2. **Confirm GitHub connection:** Project **Settings** → **Source**. Ensure the repo is `nbleicher/vc_dash` (or your fork) and the branch is `main`. If it says "Not connected" or the wrong repo, use **Connect Repo** and re-select the repo and branch.
3. **Enable deploy on push:** In the same **Settings** → **Source** (or **Deploy**), ensure "Deploy on push" / "Auto-deploy" is enabled for the `main` branch.
4. **Check GitHub App:** Railway uses a GitHub App for webhooks. In GitHub: **Settings** → **Applications** → **Installed GitHub Apps** → **Railway**. Ensure it’s installed for the org/user that owns the repo and has access to `vc_dash`. If you recently moved the repo or changed permissions, disconnect and reconnect the repo in Railway.
5. **Manual redeploy after fixing:** After reconnecting or changing settings, use step 1 to **Deploy** once; future pushes should then trigger automatically.

## 3) Deploy frontend to Cloudflare Pages

1. Create a Cloudflare Pages project from this repo.
2. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Set environment variable (required so the frontend calls your API; rebuild after changing):
   - `VITE_API_URL=https://<your-railway-service-domain>`
   - This must match the **same** Railway API URL the bot uses (`API_BASE_URL` on the VPS). If they differ, the dashboard will not show data the bot pushes; rebuild and redeploy the frontend after changing.

## 3.5) Set custom domain to `value.jawnix.com`

1. In Cloudflare Pages, open your project -> **Custom domains**.
2. Add domain: `value.jawnix.com`.
3. Create/confirm DNS record for your zone:
   - Type: `CNAME`
   - Name: `value`
   - Target: your Pages default domain (for example `<your-project>.pages.dev`)
4. Wait for domain verification and SSL status to become Active in Cloudflare Pages.
5. Update backend CORS origin in Railway:
   - `FRONTEND_ORIGIN=https://value.jawnix.com`
6. Confirm frontend build env in Cloudflare Pages:
   - `VITE_API_URL=https://<your-railway-service-domain>`
7. Redeploy backend and frontend after env/domain changes.

Notes:
- If DNS for `jawnix.com` is not managed in Cloudflare, add the same CNAME at your current DNS provider.
- Keep HTTPS enabled and only use `https://value.jawnix.com` for `FRONTEND_ORIGIN`.

### Copy/paste values for this domain

Railway (backend) environment values:

```env
FRONTEND_ORIGIN=https://value.jawnix.com
API_HOST=0.0.0.0
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<set-a-strong-password>
JWT_SECRET=<set-a-long-random-secret>
DATABASE_URL=<supabase-pooled-connection-string>
```

Cloudflare Pages (frontend) environment values:

```env
VITE_API_URL=https://<your-railway-service-domain>
```

DNS for your subdomain:

```txt
Type: CNAME
Name: value
Target: <your-pages-project>.pages.dev
```

## 4) Railway 24/7 cost envelope (low traffic)

Pricing formula (monthly):

- Memory cost = `avg_ram_gb * 2,592,000 * 0.00000386`
- CPU cost = `avg_vcpu * 2,592,000 * 0.00000772`
- Volume cost = `volume_gb * 2,592,000 * 0.00000006`
- Egress cost = `egress_gb * 0.05`
- Add platform fee (`$1/month` after trial)

Low-traffic examples for this backend:

- 0.1 vCPU + 0.1 GB RAM average -> about `$2.99` compute/month
- 0.2 vCPU + 0.25 GB RAM average -> about `$6.66` compute/month
- Typical total for this app is often `$4-$9/month` including platform fee and light egress

## 5) Migration cutover + rollback (Render -> Railway)

1. Deploy Railway backend first and validate `/health`.
2. Keep Render live while testing Railway with the same Supabase database.
3. Update Cloudflare Pages `VITE_API_URL` to Railway and redeploy frontend.
4. Smoke test: login/logout, writes/reads, and authenticated `/state` requests.
5. Monitor Railway logs/metrics for errors.
6. If issues occur, roll back by restoring Cloudflare `VITE_API_URL` to Render and redeploy frontend.

## 6) Cross-origin cookie/auth checks

1. Login from deployed frontend.
2. Ensure sign-out works and no network/CORS errors appear.
3. Verify authenticated routes (`/state`) function from browser.

## 7) Data import (optional)

If you have local SQLite data to keep:

1. Set both `DB_PATH` and `DATABASE_URL` locally.
2. Run `npm run server:import:postgres`.
3. Verify imported row counts in script output.

## 8) Troubleshooting: Dashboard still shows stale data

If the dashboard shows an old "Data" time (e.g. 3:06 PM) after the bot has pushed and you clicked Refresh, work through these:

**1. Confirm which API the built app uses**

- Open the deployed site → **Settings**. Under "Testing Utilities" you'll see **API base**. It must be your full Railway URL (e.g. `https://your-app.up.railway.app`). If it says "(not set – requests use same origin)", the build did not get `VITE_API_URL`.

**2. Build didn't get the env var**

- In Cloudflare Pages: **Settings** → **Environment variables**. Ensure `VITE_API_URL` is set for the environment that runs your production build (e.g. **Production**). Value must be the full Railway URL with no trailing slash.
- Env vars are applied at **build** time. After adding or changing the var, trigger a new build: **Deployments** → **⋯** on latest → **Retry deployment**, or push a new commit.

**3. Old bundle still served**

- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac). Or open the site in an incognito/private window. If the API base in Settings then shows Railway, the previous load was cached.

**4. Network tab: where does `/state` go?**

- DevTools → **Network** → click **Refresh** on the dashboard. Find the request whose path is `/state?...`. If the host is **value.jawnix.com**, the app is still using same-origin. If the host is your **Railway** domain, see (6) and (7).

**5. CORS blocking**

- If the request goes to Railway but the console shows a **CORS** error, set `FRONTEND_ORIGIN=https://value.jawnix.com` on Railway (exact, no trailing slash). Redeploy Railway after changing.

**6. 401 Unauthorized**

- Log in again on the deployed site so the cookie is set by Railway. If you had logged in when the app pointed at the wrong host, clear cookies and log in again.

**7. Request to Railway succeeds but data is still old**

- Bot and dashboard must use the **exact same** Railway URL. If the bot pushes to a different service or URL, the dashboard will never see that data. Confirm bot log shows `Pushed N snapshots for ...` and that you're not mixing two Railway services (e.g. staging vs prod) with different databases.

**8. Empty `VITE_API_URL`**

- If the variable is empty string, the app uses same-origin and gets HTML. Set it to the full Railway URL and trigger a new build.
