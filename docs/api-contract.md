# VC Dash API Contract

## Base

- Base URL: `http://localhost:8787`
- Auth: cookie-based JWT (`vcdash_token`)
- Response envelope:
  - Success: `{ "data": ... , "meta"?: {...} }`
  - Error: `{ "error": { "code": string, "message": string, "details"?: unknown } }`

## Health

- `GET /health` -> `{ data: { ok: true, service: "vc_dash_api" } }`

## Auth

- `POST /auth/login`
  - Body: `{ "username": string, "password": string }`
  - Success: sets auth cookie, returns `{ data: { loggedIn: true, role: "admin" } }`
- `POST /auth/logout`
  - Clears auth cookie, returns `{ data: { loggedIn: false } }`
- `GET /auth/me` (auth required)
  - Returns `{ data: { loggedIn: true, role: "admin" } }`

## State resources

Authenticated endpoints:

- `GET /state`
  - Returns full app state:
    - `agents`
    - `snapshots`
    - `perfHistory`
    - `qaRecords`
    - `auditRecords`
    - `attendance`
    - `weeklyTargets`
    - `vaultMeetings`
    - `vaultDocs`

- `GET /state/:key`
  - `:key` one of:
    - `agents`
    - `snapshots`
    - `perfHistory`
    - `qaRecords`
    - `auditRecords`
    - `attendance`
    - `weeklyTargets`
    - `vaultMeetings`
    - `vaultDocs`

- `PUT /state/:key`
  - Replaces the entire collection at `:key` with array payload.

## Export

- `POST /export/csv` (auth required)
  - Body:
    - `{ agents, performanceHistory, qa, audit, attendance }` boolean flags
  - Returns `text/csv` payload for selected sections.
