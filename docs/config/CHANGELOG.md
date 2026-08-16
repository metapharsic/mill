# Config CHANGELOG

Newest first. One line per config change. Update in the SAME change that touches
any port / version / credential / env / scrape target / topic / dashboard.

## 2026-07-05
- **Observability + streaming stack integrated** into MK Paper Mill:
  - Backend: added `prom-client` 15.1.3 → `GET /metrics` (`src/metrics.js`, wired in `server.js`).
  - Backend: added `kafkajs` 2.2.4 fail-safe producer (`src/kafka.js`); DPR POST emits `dpr.saved` → topic `mkpm.dpr.events`.
  - Prometheus: added scrape job `mk_paper_mill_backend` → `localhost:5000` in `C:\infra\prometheus\prometheus.yml` (Kapila target kept). Enabled `--web.enable-lifecycle` in `watchdog.ps1`.
  - Grafana: created `Prometheus` datasource (→ localhost:9090) + dashboard uid `mkpm-overview`.
  - Kafka: created topic `mkpm.dpr.events` (3 partitions).
  - Kafka **recovery**: log dir was corrupted (my `Remove-Item` on a live broker) → preserved as `C:\infra\kafka\data_corrupt_20260705-162524`, reformatted KRaft storage; topics auto-recreated on app reconnect (message payloads lost, structure restored).
  - Added `config/` registry + `scripts/stack-status.js`.
- **DPR engine** tables added: `furnish_mix_log`, `downtime_reason_codes`, `dpr_grade_standards`; assembler now computes variance vs standards + pulls furnish/finish/downtime.
- Data-safety guard: DPR POST refuses to overwrite a populated/approved report with empty autofill (409 unless `force=true`).

## Earlier
- HRMS (Ph16) migration applied; `employees` expanded to 44 cols; auth exposes `emp_id`/`is_dept_head`/`is_hr_admin`.
- Daily Production Report (DPR) module + tables + routes created under `/api/production/daily-report`.
