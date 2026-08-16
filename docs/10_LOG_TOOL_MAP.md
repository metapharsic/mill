# MK Paper Mill ERP — Log & Tool Map

> Inventory of all logging points, monitoring tools, and debug utilities in the system.

---

## 1. Server Logs

### Console Log Patterns (backend/src/server.js)
| Tag | What it logs |
|---|---|
| `[KPI Cron] error:` | KPI snapshot job failures |
| `[Notifications] table init error:` | Notifications table creation failure on boot |
| `[PIIMAS Escalation] error:` | PIIMAS escalation cron failures |
| `[PIIMAS Escalation] Processed N overdue indents` | Escalation job summary |
| `[ERROR] METHOD /path msg` | JSON error handler (dev only) |
| `MK Paper Mill ERP server running on port N` | Server startup confirmation |
| `FATAL: JWT_SECRET ...` | JWT boot guard failure |

### How to View Logs
```bash
# PM2 (production)
pm2 logs mk-paper-mill-backend
pm2 logs mk-paper-mill-backend --lines 100

# Direct (development)
cd backend && npm run dev
# Logs go to stdout

# Log files (if configured in ecosystem.config.js)
cat backend/logs/combined.log
cat backend/logs/error.log
```

---

## 2. Database Logging

### Audit Log Table (`audit_log`)
Every admin action is written here:
```sql
SELECT * FROM audit_log
WHERE module = 'users'
ORDER BY created_at DESC
LIMIT 50;
```

Columns: `user_id, action, module, record_id, old_data (JSONB), new_data (JSONB), ip_address, created_at`

### Store Indent Log (`store_indent_log`)
Every stock deduction from store:
```sql
SELECT * FROM store_indent_log
WHERE indent_id = 123
ORDER BY created_at DESC;
```

---

## 3. Prometheus Metrics (`/metrics`)

Exposed at: `GET http://localhost:5000/metrics`

Collected by `prom-client` via `backend/src/metrics.js`:
- HTTP request duration histogram
- HTTP request count by route + status
- Node.js default metrics (memory, CPU, GC)

### Sample Queries (if Prometheus is configured)
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# p95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

---

## 4. Dev Tools

### Progress Dashboard
- URL: `http://localhost:5000/dev/progress` (HTML UI)
- API: `GET /api/dev/progress` (JSON)
- Reads: `checkpoint.json` in project root
- Purpose: Development milestone tracking

### DB Check Script
```bash
cd backend && node check-db.js
# Quick sanity check: can connect to DB?
```

### Preflight Script
```bash
cd backend && npm run preflight
# Checks: DB connection, required env vars, table existence
```

### Sync Check Script
```bash
cd backend && npm run synccheck
# Checks: backend routes vs frontend expected APIs
```

### Migration Status
```bash
cd backend && npm run db:status
# Shows which migrations have been applied
```

### Seed / Import Scripts
```bash
# Seed login users
psql -d mk_paper_mill -f db/seed_logins.sql

# Seed store inventory
psql -d mk_paper_mill -f db/seed_store_inventory_import.sql

# Import store inventory (Python)
cd db && python import_store_inventory.py
```

---

## 5. Frontend Debugging

### Token Inspection
```javascript
// In browser console
localStorage.getItem('mk_token')  // See current JWT
// Decode at jwt.io to inspect payload
```

### API Base URL
```javascript
// In browser console
import.meta.env.VITE_API_URL  // Should be '' for same-origin or configured URL
```

### Network Tab
- All API calls start with `/api/`
- Auth header: `Authorization: Bearer <token>`
- Failed auth: 401 (invalid/expired token), 403 (insufficient role)

---

## 6. Kafka (if enabled)

### Configuration (in `backend/src/kafka.js`)
- Producer and consumer setup
- Topics: configured via environment variables
- Enabled only when Kafka broker is configured

### Check Kafka Status
```bash
# Check if Kafka is configured
grep KAFKA .env
# If no KAFKA_ vars, Kafka is disabled
```

---

## 7. PM2 Process Manager

### Key Commands
```bash
# Status of all processes
pm2 status

# Restart server
pm2 restart mk-paper-mill

# View logs
pm2 logs

# Monitor in real-time
pm2 monit

# Save process list
pm2 save

# Start from ecosystem config
pm2 start ecosystem.config.js
```

### Process Names (ecosystem.config.js)
- Backend server: `mk-paper-mill-backend` (or as named in ecosystem.config.js)

---

## 8. Error Investigation Checklist

When something goes wrong, check in this order:

1. **PM2 logs** (`pm2 logs`) — runtime errors
2. **Browser network tab** — API request/response details
3. **DB audit_log** — who did what when
4. **store_indent_log** — stock movement discrepancies
5. **PostgreSQL logs** — query errors, constraint violations
6. **Prometheus /metrics** — traffic spikes, error rates
7. **Kafka consumer lag** (if Kafka enabled) — event processing delays

---

*Last updated: 2026-07-17 | See 09_CODING_STANDARDS for log tag conventions*
