# Grafana OSS

- **Version:** 13.1.0 (installed via winget `GrafanaLabs.Grafana.OSS`)
- **Home:** `C:\Program Files\GrafanaLabs\grafana`
- **Port:** `3000`  → http://localhost:3000
- **Login:** `admin` / `admin`  (change in prod)
- **Managed by:** Windows/winget service (NOT the watchdog)
- **Config:** `C:\Program Files\GrafanaLabs\grafana\conf\` (`defaults.ini`, `custom.ini`)

## Datasource

| Name | Type | URL | Default |
|------|------|-----|---------|
| Prometheus | prometheus | http://localhost:9090 | yes |

(uid assigned at create time — look it up via API if scripting.)

## Dashboards

| Dashboard | UID | URL |
|-----------|-----|-----|
| MK Paper Mill — Backend Overview | `mkpm-overview` | http://localhost:3000/d/mkpm-overview |

Panels: Backend Up · HTTP req/s by route · p95 latency by route · DPR PM/C Production (MT).

## How to modify (via HTTP API, admin:admin)

- **Add datasource:**
  ```
  curl -s -u admin:admin -H "Content-Type: application/json" \
    -d '{"name":"Prometheus","type":"prometheus","url":"http://localhost:9090","access":"proxy","isDefault":true}' \
    http://localhost:3000/api/datasources
  ```
- **Import/overwrite dashboard:** POST JSON to `http://localhost:3000/api/dashboards/db`
  with `{"dashboard":{...,"uid":"mkpm-overview"},"overwrite":true}`.
- **List datasources:** `curl -s -u admin:admin http://localhost:3000/api/datasources`
- Health: `curl -s http://localhost:3000/api/health`

## Change log
- 2026-07-05 — created Prometheus datasource + `mkpm-overview` dashboard.
