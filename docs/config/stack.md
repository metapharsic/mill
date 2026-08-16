# Stack / Infra — watchdog, nginx, PM2, `C:\infra` layout

## `C:\infra` layout (shared local stack)

```
C:\infra\
  kafka\                 Kafka 3.9.0 (KRaft) — broker 9092, controller 9093
    config\server.properties
    data\                log.dirs (live)
    data_corrupt_*\      preserved corrupted dir(s)
  prometheus\            Prometheus 3.13.0 — 9090
    prometheus.yml       scrape config
    data\                TSDB
  watchdog.ps1           relaunches Kafka + Prometheus if a port dies (15s loop)
  watchdog.log
  install-services-admin.ps1
```
Grafana is NOT here — it is winget-installed under `C:\Program Files\GrafanaLabs\grafana`.

## Watchdog (`C:\infra\watchdog.ps1`)

- Runs as the logged-in user (no admin), auto-starts via a Startup-folder shortcut.
- Every 15s: if port 9092 down → start Kafka; if 9090 down → start Prometheus
  (`--web.enable-lifecycle`).
- Does **not** manage Grafana or the MK backend.
- Start manually (hidden): `powershell -NoProfile -WindowStyle Hidden -File C:\infra\watchdog.ps1`

## App process management (this repo)

- **PM2:** `ecosystem.config.js` (backend). `nginx`: `infra/nginx.conf`, `deploy/nginx.conf.sample`.
- **Dev run:** backend `node src/server.js` (port 5000); frontend `npm run dev` (Vite 5173).

## Start / stop / status

| Action | Command |
|--------|---------|
| Status (all ports + health) | `node scripts/stack-status.js` |
| Start Kafka (manual) | `set JAVA_HOME=...jdk-17...; C:\infra\kafka\bin\windows\kafka-server-start.bat C:\infra\kafka\config\server.properties` |
| Reload Prometheus | `curl -X POST http://localhost:9090/-/reload` |
| Restart backend | stop node on :5000 → `node backend/src/server.js` |

## Ports summary

| Port | Service |
|------|---------|
| 5000 | MK backend |
| 5173 | Vite dev (frontend) |
| 5432 | PostgreSQL |
| 9090 | Prometheus |
| 9092 / 9093 | Kafka broker / controller |
| 3000 | Grafana |
| 3001 | Kapila backend (shared box) |

## Change log
- 2026-07-05 — documented shared stack; watchdog gained `--web.enable-lifecycle`; added `scripts/stack-status.js`.
