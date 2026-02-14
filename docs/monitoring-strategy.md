# Monitoring Strategy

## Backend

- Use Fastify logger for request-level logs.
- Track:
  - non-2xx response counts
  - auth failure counts
  - route latency percentiles
- Expose `GET /health` for readiness checks.

## Frontend

- Capture failed API requests in UI error state.
- Log client-side exceptions with a browser telemetry provider in production.

## Alerting thresholds (initial)

- 5xx rate > 2% for 5 minutes
- auth failures spike above baseline
- `/health` unavailable for more than 1 minute
