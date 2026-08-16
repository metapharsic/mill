# Observability & Streaming Stack — Kafka · Prometheus · Grafana

Local-dev stack that gives MK Paper Mill live metrics, dashboards, and an event
bus. All three run as **portable Windows binaries** (no Docker, no admin) and are
kept alive by a user-level **watchdog** (`C:\infra\watchdog.ps1`).

> This is a **shared local stack** — the same Kafka/Prometheus/Grafana instances
> also serve the Kapila project. MK Paper Mill was added alongside it, nothing was
> removed.

---

## 1. What runs where

| Component | Port | Home | Managed by |
|-----------|------|------|-----------|
| Kafka broker (KRaft, no ZooKeeper) | 9092 | `C:\infra\kafka` | watchdog.ps1 |
| Kafka controller (KRaft quorum) | 9093 | `C:\infra\kafka` | watchdog.ps1 |
| Prometheus | 9090 | `C:\infra\prometheus` | watchdog.ps1 |
| Grafana OSS 13.1 | 3000 | `C:\Program Files\GrafanaLabs\grafana` | winget service |
| MK Paper Mill backend | 5000 | this repo | PM2 / node |

JDK: `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot` (Kafka needs Java).

---

## 2. Metrics flow (Prometheus + Grafana)

```
MK backend  ──/metrics──▶  Prometheus (scrape 15s)  ──query──▶  Grafana dashboard
 (prom-client)              job: mk_paper_mill_backend            "MK Paper Mill — Backend Overview"
```

- **Backend**: `backend/src/metrics.js` registers default Node/process metrics +
  `mkpm_http_requests_total`, `mkpm_http_request_duration_seconds`,
  `mkpm_dpr_pmc_production_mt` (gauge, set on every DPR save). Exposed at
  `GET /metrics` (wired in `server.js`).
- **Prometheus**: scrape target added in `C:\infra\prometheus\prometheus.yml`
  under job `mk_paper_mill_backend` → `localhost:5000`. (Kapila target kept.)
- **Grafana**: datasource `Prometheus` (uid varies) → `http://localhost:9090`.
  Dashboard uid `mkpm-overview` → http://localhost:3000/d/mkpm-overview
  (login admin / admin).

Reload Prometheus config after editing the yml:
`curl -X POST http://localhost:9090/-/reload` (lifecycle flag now enabled), or
kill `prometheus.exe` and the watchdog relaunches it within 15s.

---

## 3. Event bus (Kafka)

- **Producer**: `backend/src/kafka.js` — fail-safe (`publish()` never throws,
  never blocks; if the broker is down the event is silently dropped and the ERP
  keeps working). Toggle with `KAFKA_ENABLED` (default on), brokers via
  `KAFKA_BROKERS` (default `localhost:9092`).
- **Topic**: `mkpm.dpr.events` (3 partitions). The Daily Production Report POST
  publishes a `dpr.saved` event `{ report_id, report_date, machine_id,
  pmc_production_mt, status, by, at }` after commit.
- Consume for debugging:
  `C:\infra\kafka\bin\windows\kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic mkpm.dpr.events --from-beginning`

Future: other modules (production reels, stock, purchase) can publish to their own
`mkpm.*` topics for real-time fan-out to dashboards/consumers.

---

## 4. Start / stop / status

- **Status** (all ports): `node scripts/stack-status.js` (or `powershell scripts/stack-status.ps1`).
- **Everything auto-starts**: watchdog relaunches Kafka + Prometheus on login /
  if a port dies. Grafana runs as a winget-managed service.
- **Manual Kafka start** (if watchdog off):
  ```
  set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot
  C:\infra\kafka\bin\windows\kafka-server-start.bat C:\infra\kafka\config\server.properties
  ```

---

## 5. Recovery note — Kafka log-dir reset (2026-07-05)

The Kafka `data\` dir was reset and re-formatted (KRaft) after a log-segment
corruption left the broker crash-looping (`KafkaStorageException: log dir …
already offline`). The corrupted dir was **preserved** as
`C:\infra\kafka\data_corrupt_<timestamp>` (not deleted). Topic **structure**
auto-recreated when the apps reconnected; only old (already-corrupted) message
payloads were lost. Kafka message data here is transient — the source of truth is
PostgreSQL, so events are replayable.
