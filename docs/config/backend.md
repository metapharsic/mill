# Backend — Node / Express

- **Runtime:** node **v25.6.1**
- **Framework:** express **4.22.2**
- **Entry:** `backend/src/server.js`
- **Port:** `5000` (env `PORT`)
- **Process mgr:** PM2 (`ecosystem.config.js`) or `node src/server.js`

## Key dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | 4.22.2 | HTTP server |
| pg | 8.22.0 | PostgreSQL driver (pool at `src/db/pool.js`) |
| jsonwebtoken | — | JWT auth (`src/middleware/auth.js`) |
| bcryptjs | — | password hashing |
| prom-client | 15.1.3 | Prometheus metrics |
| kafkajs | 2.2.4 | Kafka producer (fail-safe) |
| multer / pdfkit | — | HR uploads / payslip PDF |

## Environment (`backend/.env`)

| Key | Meaning | Default (dev) |
|-----|---------|---------------|
| `PORT` | HTTP port | 5000 |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | Postgres | localhost:5432 / mk_paper_mill / postgres/postgres |
| `JWT_SECRET` | token signing key | dev placeholder — **set strong in prod** |
| `JWT_EXPIRES_IN` | token TTL | 8h |
| `NODE_ENV` | environment | development |
| `KAFKA_ENABLED` | toggle Kafka producer | (unset = on) |
| `KAFKA_BROKERS` | broker list | localhost:9092 |

> Secrets live only in `.env` (git-ignored). Never commit real JWT_SECRET / DB pw.

## Metrics (Prometheus)

- Module: `src/metrics.js`. Exposed at **`GET /metrics`** (wired in `server.js`).
- Default Node/process metrics + custom:
  - `mkpm_http_requests_total{method,route,status}`
  - `mkpm_http_request_duration_seconds{method,route,status}` (histogram)
  - `mkpm_dpr_pmc_production_mt{machine}` (gauge — set on every DPR save)
- Scraped by Prometheus job `mk_paper_mill_backend` — see [prometheus.md](prometheus.md).

## Kafka producer

- Module: `src/kafka.js` — **fail-safe**: `publish()` never throws / never blocks;
  if broker down the event is dropped and the ERP keeps running.
- Topic: `mkpm.dpr.events`. Emits `dpr.saved` on Daily Production Report POST.
- Config via `KAFKA_ENABLED` / `KAFKA_BROKERS`. See [kafka.md](kafka.md).

## How to modify
- **Add env var:** add to `.env` + document row above + read via `process.env.X`.
- **Add a metric:** define in `src/metrics.js` (register on the shared registry).
- **Add a Kafka event:** `kafka.publish(topic, key, value)` — fire-and-forget.

## Change log
- 2026-07-05 — added prom-client `/metrics` + kafkajs producer; new `src/metrics.js`, `src/kafka.js`.
