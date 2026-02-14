# Deploy Free Stack (Cloudflare Pages + Render + Supabase)

## 1) Provision Supabase Postgres (free)

1. Create a new Supabase project.
2. Run SQL migration from `supabase/migrations/20260214_app_state.sql`.
3. Copy the pooled Postgres `DATABASE_URL`.

## 2) Deploy backend to Render (free web service)

1. Connect this repository in Render.
2. Use `render.yaml` (or set manually):
   - build: `npm ci`
   - start: `npm run server:start`
3. Configure env vars:
   - `DATABASE_URL` (Supabase)
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `FRONTEND_ORIGIN` (Cloudflare Pages domain)
4. Confirm `GET /health` returns `{ data: { ok: true, db: "ok" } }`.

## 3) Deploy frontend to Cloudflare Pages (free)

1. Create a Cloudflare Pages project from this repo.
2. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Set environment variable:
   - `VITE_API_URL` = your Render API URL

## 3.5) Set custom domain to `value.jawnix.com`

1. In Cloudflare Pages, open your project -> **Custom domains**.
2. Add domain: `value.jawnix.com`.
3. Create/confirm DNS record for your zone:
   - Type: `CNAME`
   - Name: `value`
   - Target: your Pages default domain (for example `<your-project>.pages.dev`)
4. Wait for domain verification and SSL status to become Active in Cloudflare Pages.
5. Update backend CORS origin in Render:
   - `FRONTEND_ORIGIN=https://value.jawnix.com`
6. Confirm frontend build env in Cloudflare Pages:
   - `VITE_API_URL` remains your Render API URL
   - Optional: if you later set up an API subdomain (for example `api.jawnix.com`), point `VITE_API_URL` to that HTTPS URL instead.
7. Redeploy backend and frontend after env/domain changes.

Notes:
- If DNS for `jawnix.com` is not managed in Cloudflare, add the same CNAME at your current DNS provider.
- Keep HTTPS enabled and only use `https://value.jawnix.com` for `FRONTEND_ORIGIN`.

### Copy/paste values for this domain

Render (backend) environment values:

```env
FRONTEND_ORIGIN=https://value.jawnix.com
API_HOST=0.0.0.0
API_PORT=10000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<set-a-strong-password>
JWT_SECRET=<set-a-long-random-secret>
DATABASE_URL=<supabase-pooled-connection-string>
```

Cloudflare Pages (frontend) environment values:

```env
VITE_API_URL=https://<your-render-service>.onrender.com
```

DNS for your subdomain:

```txt
Type: CNAME
Name: value
Target: <your-pages-project>.pages.dev
```

### Verification checklist for `value.jawnix.com`

- Open `https://value.jawnix.com` and confirm the site loads.
- Confirm SSL/TLS status is Active for the custom domain in Cloudflare Pages.
- Login succeeds from `https://value.jawnix.com`.
- Browser console shows no CORS errors during auth/data requests.
- Logout succeeds and authenticated `/state` requests work as expected.

## 4) Cross-origin cookie/auth checks

1. Login from deployed frontend.
2. Ensure sign-out works and no network/CORS errors appear.
3. Verify authenticated routes (`/state`) function from browser.

## 5) Data import (optional)

If you have local SQLite data to keep:

1. Set both `DB_PATH` and `DATABASE_URL` locally.
2. Run `npm run server:import:postgres`.
3. Verify imported row counts in script output.
