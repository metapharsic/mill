# MK Paper Mill — Config Registry

Single source of truth for **every piece of software the system uses**: versions,
ports, config file locations, credentials, and how to modify each safely.

> ⚠️ **KEEP THIS UPDATED.** Whenever you change a port, version, credential, env
> var, scrape target, topic, dashboard, or any infra setting — update the matching
> file here **and** add a dated line to [`CHANGELOG.md`](CHANGELOG.md) in the same
> change. If it is not written here, it does not exist.

---

## Golden reference table

| Software | Version | Port(s) | Config location | Managed by | Creds |
|----------|---------|---------|-----------------|-----------|-------|
| Node/Express backend | node v25.6.1 · express 4.22.2 | **5000** | `backend/.env` | PM2 / node | JWT in `.env` |
| React/Vite frontend | React 18 · Vite | 5173 (dev) | `frontend/vite.config.js` | vite / static | — |
| PostgreSQL | 14+ | **5432** | `backend/.env` (`DB_*`) | Windows service | postgres/postgres |
| Apache Kafka | 3.9.0 (KRaft) | **9092** broker · **9093** controller | `C:\infra\kafka\config\server.properties` | `C:\infra\watchdog.ps1` | none (PLAINTEXT) |
| Prometheus | 3.13.0 | **9090** | `C:\infra\prometheus\prometheus.yml` | `C:\infra\watchdog.ps1` | none |
| Grafana OSS | 13.1.0 | **3000** | `C:\Program Files\GrafanaLabs\grafana\conf` | winget service | admin/admin |

Live status any time: `node scripts/stack-status.js`

---

## Files in this folder

| File | Covers |
|------|--------|
| [backend.md](backend.md) | Node/Express — env vars, metrics, Kafka producer, scripts |
| [frontend.md](frontend.md) | React/Vite — ports, API base, build |
| [postgres.md](postgres.md) | Database — connection, migrations, key tables |
| [kafka.md](kafka.md) | Kafka — KRaft, topics, add-topic, recovery |
| [prometheus.md](prometheus.md) | Prometheus — scrape jobs, add-target, reload |
| [grafana.md](grafana.md) | Grafana — datasource, dashboards, API |
| [stack.md](stack.md) | Watchdog, nginx, PM2, `C:\infra` layout, start/stop |
| [CHANGELOG.md](CHANGELOG.md) | Dated log of every config change |

---

## Update discipline (the rule)

1. Change the real config (e.g. `prometheus.yml`).
2. Mirror the change in the matching `config/*.md` (values + "how to modify").
3. Add one dated line to `CHANGELOG.md`.
4. Commit all together.

Real runtime configs for Kafka/Prometheus live under `C:\infra` (shared with the
Kapila project) — those are **not** in this repo. This folder documents them and
holds annotated snapshots so any modification is traceable from the repo.
