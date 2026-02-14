# VC Dash

VC Dash is a React + TypeScript frontend with a Fastify backend API.
The backend supports:
- local SQLite (`DB_PATH`) for development
- managed Postgres (`DATABASE_URL`) for deployment

## Local development

1. Install dependencies:
   - `npm install`
2. Copy env vars:
   - `cp .env.example .env`
3. Run backend API:
   - `npm run server:dev`
4. Run frontend:
   - `npm run dev`

Frontend default URL: `http://localhost:5173`  
Backend default URL: `http://localhost:8787`

## Scripts

- `npm run dev` - start Vite frontend
- `npm run server:dev` - start Fastify API in watch mode
- `npm run build` - typecheck frontend + backend and build frontend bundle
- `npm run lint` - lint repository
- `npm run test` - frontend tests
- `npm run test:server` - backend tests
- `npm run server:seed` - seed SQLite dev data
- `npm run server:import:postgres` - one-time SQLite -> Postgres data import

## API + Auth

- API contract: `docs/api-contract.md`
- Auth model: simple admin login (`POST /auth/login`) with cookie-based JWT.
- Deployment guide: `docs/deploy-free-stack.md`

## Deploy + rollback

1. Build and test:
   - `npm run lint`
   - `npm run test`
   - `npm run test:server`
   - `npm run build`
2. Deploy frontend and backend artifacts.
3. Run smoke tests:
   - `GET /health`
   - login flow
   - state read/write flow
4. Rollback strategy:
   - Deploy previous artifact version for frontend/backend.
   - Restore previous Postgres backup/snapshot when schema/data issues are detected.
