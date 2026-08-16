# Deployment

---

## 1. Environment

File: `backend/.env` (copy from `backend/.env.example` — never commit)

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=mk_paper_mill
DB_USER=postgres
DB_PASSWORD=yourpassword

# minimum 64 random chars in production
JWT_SECRET=change_this_to_a_secure_64_char_random_string
JWT_EXPIRES_IN=8h
```

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Pool config (`backend/src/db/pool.js`):
- max 20 connections
- idleTimeoutMillis 30000
- connectionTimeoutMillis 2000

---

## 2. Database Init

### Base schema (all core tables)
```bash
cd "C:\Project\MK Paper Mill\backend"
npm run db:init
# runs: node src/db/init.js
```
- Reads `db/schema.sql` → CREATE TABLE IF NOT EXISTS (safe to re-run)
- Sets admin password hash (bcrypt of `Admin@1234`)
- Seeds: 4 machines (PM1, PM2, RW1, CT1), 5 grades (KP, WP, NP, BRD, TIS), 20 departments, 5 roles

### Phase 3 migration (MES additions)
```bash
psql -U postgres -d mk_paper_mill -f db/phase3_migration.sql
```
Adds:
- `machines.ideal_speed_mpm NUMERIC(8,2) DEFAULT 0` — OEE performance calc
- `machines.code VARCHAR(20)` — reel number generation
- `shifts.status VARCHAR(20) DEFAULT 'Open' CHECK IN ('Open','Closed')`
- `shifts.shift_type` CHECK expanded to include `'General'`
- `shifts.end_time` made nullable

### Phase 14 migration (extended modules)
```bash
psql -U postgres -d mk_paper_mill -f db/migration_phase14.sql
```
Creates: `store_issues`, `scrap_records`, `packing_records`, `gate_passes`, `lab_samples`, `ehs_incidents`, `system_settings`
Seeds: 12 system_settings keys (company_name, company_gst, sequence prefixes, etc.)

### Migration order
```
1. npm run db:init    (schema.sql + seeds)
2. phase3_migration.sql
3. migration_phase14.sql
```
All migrations use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` — safe to re-run.

---

## 3. Development (Windows)

### Start all
```
C:\Project\MK Paper Mill\start.bat
```
What it does:
1. Kills processes on ports 5000 and 8787
2. Starts backend: `cd backend && npm run dev` (nodemon) → `logs/backend.log`
3. Waits 3 seconds
4. Starts frontend: `cd frontend && npm run dev` (Vite) → `logs/frontend.log`

### Stop all
```
C:\Project\MK Paper Mill\stop.bat
```
Kills by port (5000, 8787) and by window title (MK-Backend, MK-Frontend).

### Manual start
```bash
# Terminal 1
cd "C:\Project\MK Paper Mill\backend"
npm run dev

# Terminal 2
cd "C:\Project\MK Paper Mill\frontend"
npm run dev
```

### URLs
| Service | URL |
|---------|-----|
| Frontend | http://localhost:8787 |
| Backend API | http://localhost:5000/api |
| Health check | http://localhost:5000/api/health |

### Default admin login
- Email: `admin@mkpapermill.com`
- Password: `Admin@1234`

---

## 4. Production (PM2)

Config: `ecosystem.config.js` (project root)

```js
module.exports = {
  apps: [{
    name: 'mk-erp-backend',
    script: './backend/src/server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: { NODE_ENV: 'production', PORT: 5000 },
    error_file: './logs/backend-error.log',
    out_file:   './logs/backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '512M',
    restart_delay: 3000,
    max_restarts: 10,
  }]
};
```

PM2 commands:
```bash
npx pm2 start ecosystem.config.js
npx pm2 status
npx pm2 logs mk-erp-backend --lines 50
npx pm2 restart mk-erp-backend --update-env
npx pm2 stop mk-erp-backend
npx pm2 delete mk-erp-backend
npx pm2 startup && npx pm2 save   # auto-start on boot
```

### Frontend build
```bash
cd "C:\Project\MK Paper Mill\frontend"
npm run build
# Output: frontend/dist/
```

In `NODE_ENV=production`, backend serves `frontend/dist` as static:
```js
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/dist/index.html')));
```
Single port 5000 serves both API (`/api/*`) and frontend (`*`).

---

## 5. Vite Proxy (Dev only)

`frontend/vite.config.js`:
```js
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  }
}
```

All `/api/*` from port 8787 → backend port 5000. Dev only. Not needed in production.

---

## 6. Health Check

```bash
curl http://localhost:5000/api/health
# { "status": "ok", "time": "2026-06-28T..." }
```

Always run health check FIRST when debugging login or frontend issues.

---

## 7. Logs

| File | Contents |
|------|----------|
| `logs/backend.log` | Backend stdout (dev via start.bat) |
| `logs/frontend.log` | Frontend stdout (dev via start.bat) |
| `logs/backend-out.log` | PM2 stdout (production) |
| `logs/backend-error.log` | PM2 stderr (production) |

---

## 8. Troubleshooting

### "Failed to execute 'json' on 'Response'" in browser
Backend not running. Check: `curl http://localhost:5000/api/health`.
Empty response body → Vite proxy hits nothing → `res.json()` throws in frontend.

### "ar is not a function" on backend start
Route file importing from `../server` instead of `../middleware/helpers`.
Fix: `const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers');`

### EADDRINUSE port 5000
Backend already running. Check: `netstat -ano | findstr :5000`. Use stop.bat.

### DB connection refused
Verify `.env` has correct `DB_HOST`, `DB_USER`, `DB_PASSWORD`. PostgreSQL service must be running.

### JWT invalid / 401 on all routes
`JWT_SECRET` changed after tokens issued — users must re-login.
Or `.env` not loaded — check `require('dotenv').config()` at top of server.js.

### Phase 14 routes crash on start
`migration_phase14.sql` not run yet — tables missing. Run migration, restart backend.

### Phase 3 columns missing (machines.code, shifts.status)
`phase3_migration.sql` not run. Run it: `psql -U postgres -d mk_paper_mill -f db/phase3_migration.sql`
