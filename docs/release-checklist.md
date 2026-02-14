# Release Checklist

## Pre-release gates

- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run test:server` passes
- [ ] `npm run build` passes
- [ ] API contract changes reviewed (`docs/api-contract.md`)
- [ ] `.env` values validated for target environment

## Smoke tests

- [ ] `GET /health` returns 200
- [ ] Admin login/logout works
- [ ] Dashboard writes/readbacks persist
- [ ] Tasks updates persist
- [ ] Vault meeting/doc flows persist
- [ ] CSV export endpoint returns data

## Rollback criteria

Rollback immediately if any of the following occurs:

- API auth fails for valid admin credentials
- Data persistence fails (writes not visible on subsequent reads)
- Elevated error rate after deploy

## Rollback actions

1. Re-deploy previous backend artifact.
2. Re-deploy previous frontend artifact.
3. Restore previous SQLite backup when required.
4. Re-run smoke tests.
