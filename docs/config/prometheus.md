# Prometheus

- **Version:** 3.13.0
- **Home:** `C:\infra\prometheus`
- **Port:** `9090`  → UI http://localhost:9090
- **Config:** `C:\infra\prometheus\prometheus.yml`
- **Data (TSDB):** `C:\infra\prometheus\data`
- **Managed by:** `C:\infra\watchdog.ps1` (launched with `--web.enable-lifecycle`)
- **Global scrape interval:** 15s

## Scrape jobs (`prometheus.yml`)

| Job | Target | metrics_path | Notes |
|-----|--------|--------------|-------|
| `prometheus` | localhost:9090 | /metrics | self-monitor |
| `kapila-backend` | localhost:3001 | /metrics | Kapila (shared) — keep |
| `mk_paper_mill_backend` | localhost:5000 | /metrics | MK Paper Mill |

```yaml
  - job_name: "mk_paper_mill_backend"
    metrics_path: /metrics
    static_configs:
      - targets: ["localhost:5000"]
        labels:
          app: "mk_paper_mill"
```

## Useful

- Targets health: http://localhost:9090/targets
- Query MK up: `up{job="mk_paper_mill_backend"}` → `1`
- Sample queries: `sum(rate(mkpm_http_requests_total[1m])) by (route)` ·
  `histogram_quantile(0.95, sum(rate(mkpm_http_request_duration_seconds_bucket[5m])) by (le,route))`

## How to modify

- **Add a scrape target:** add a `job_name` block to `prometheus.yml`, then
  **reload**: `curl -X POST http://localhost:9090/-/reload`
  (lifecycle enabled), or kill `prometheus.exe` → watchdog relaunches ≤15s.
- **Change data retention / flags:** edit `Start-Prometheus` args in
  `C:\infra\watchdog.ps1` (that is what actually launches it).

## Change log
- 2026-07-05 — added `mk_paper_mill_backend` job; enabled `--web.enable-lifecycle` via watchdog.
