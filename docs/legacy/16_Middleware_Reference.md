# Middleware Reference

Files:
- `backend/src/middleware/auth.js` — JWT validation + role guard
- `backend/src/middleware/helpers.js` — re-exports pool + auth + ar for Phase 14 routes
- `backend/src/db/pool.js` — PostgreSQL connection pool

---

## 1. helpers.js

**Path:** `backend/src/middleware/helpers.js`

```js
const pool = require('../db/pool');
const { auth: requireAuth, requireLevel } = require('./auth');

const ar = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  });

module.exports = { pool, requireAuth, requireLevel, ar };
```

### CRITICAL RULE
ALL Phase 14 route files import from `../middleware/helpers`. NEVER from `../server`.

```js
// CORRECT
const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers');

// WRONG — server.js exports nothing → "ar is not a function" crash
const { pool, requireAuth, ar } = require('../server');
```

### Exports
| Export | Type | Source |
|--------|------|--------|
| `pool` | pg.Pool | `../db/pool` |
| `requireAuth` | middleware | `auth.js` `auth` fn, aliased |
| `requireLevel(n)` | middleware factory | `auth.js` |
| `ar` | wrapper factory | defined in helpers.js |

---

## 2. auth.js

**Path:** `backend/src/middleware/auth.js`
**Exports:** `{ auth, requireLevel }`

### auth middleware — request flow
```
1. Extract Bearer token: req.headers.authorization = "Bearer <token>"
2. jwt.verify(token, process.env.JWT_SECRET)
3. DB re-fetch on every request:
   SELECT u.*, r.name AS role, r.level AS role_level, r.permissions,
          d.name AS department, d.code AS dept_code
   FROM users u
   JOIN roles r ON u.role_id=r.id
   LEFT JOIN departments d ON u.department_id=d.id
   WHERE u.id=$1 AND u.is_active=true
4. Sets req.user = full user row
5. next() if valid, res.status(401) if not
```

Token: JWT, 8h expiry, secret = `process.env.JWT_SECRET`.

### req.user shape
```js
{
  id: 1,
  name: 'Admin',
  email: 'admin@mkpapermill.com',
  role: 'Admin',
  role_level: 5,
  permissions: { /* JSONB from roles table */ },
  department: 'Administration',
  dept_code: 'ADMIN',
  is_active: true
}
```

### requireLevel(n)
```js
// Checks req.user.role_level >= n
// Returns 403 JSON if insufficient
```

Role level table:
| Level | Name | Access |
|-------|------|--------|
| 1 | Operator | Record reels, view own data |
| 2 | Supervisor | Approve store issues, mark attendance, approve GRN QC |
| 3 | Manager | PO approve, sales access, finance read |
| 4 | PlantHead | Admin settings read, audit log, all modules |
| 5 | Admin | Full — settings write, user management |

---

## 3. Import Pattern by Route File

Two valid patterns — do NOT create a third.

### Pattern A — Legacy (Phase 1–12 route files)
```js
const { auth, requireLevel } = require('../middleware/auth');
const pool = require('../db/pool');

const ar = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  });
```
Used by: `reports.js`, `hr.js`, `finance.js`, `production.js`, `procurement.js`, `sales.js`, `dispatch.js`, `quality.js`, `maintenance.js`, `utility.js`

### Pattern B — helpers.js (Phase 14 route files)
```js
const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers');
```
Used by: `store.js`, `admin.js`, `ehs.js`, `scrap.js`, `warehouse.js`, `laboratory.js`, `security.js`

`requireAuth` = `auth` (same function, different alias).

---

## 4. ar — Async Error Wrapper

```js
const ar = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  });
```

Purpose: catches thrown errors or rejected promises in async handlers.
Returns `{ success: false, message: 'Server error' }` with HTTP 500.

```js
// CORRECT — ar wraps the handler
router.post('/issues', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query('...');  // throw here → ar catches → 500
  res.json({ success: true, data: rows });
}));

// WRONG — uncaught rejection crashes Node process
router.post('/issues', requireAuth, async (req, res) => {
  const { rows } = await pool.query('...');  // if this throws → unhandled rejection
});
```

---

## 5. pool.js — DB Connection

**Path:** `backend/src/db/pool.js`

Config from `.env`:
- `DB_HOST` default `localhost`
- `DB_PORT` default `5432`
- `DB_NAME` default `mk_paper_mill`
- `DB_USER` default `postgres`
- `DB_PASSWORD` default `postgres`
- Pool: max 20 connections, idleTimeoutMillis 30000, connectionTimeoutMillis 2000

### ACID Transaction Template
```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... all mutations
  await client.query('COMMIT');
  res.json({ success: true, data: result });
} catch (e) {
  await client.query('ROLLBACK');
  throw e;  // ar() catches → returns 500
} finally {
  client.release();  // ALWAYS release — even on throw
}
```

NEVER skip `client.release()` — pool exhaustion kills the server.

---

## 6. Response Shape Convention

All routes return:
```js
// Success
res.json({ success: true, data: rows[0] });         // single
res.json({ success: true, data: rows });              // list
res.json({ success: true, data: { ...summary } });   // aggregate

// Error (ar auto-returns this on unhandled throw)
res.status(500).json({ success: false, message: 'Server error' });

// Validation error (route code)
res.status(400).json({ success: false, message: 'Reason' });

// Auth error (auth middleware)
res.status(401).json({ message: 'Unauthorized' });
res.status(403).json({ message: 'Forbidden' });
```

Frontend: check `response.success` before reading `response.data`.
`pg` driver returns NUMERIC columns as strings — always `parseFloat()` before arithmetic.
