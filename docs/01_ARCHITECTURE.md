# MK Paper Mill ERP — Architecture Overview

> **AI INSTRUCTION:** Read this document FIRST before writing any code for this project.
> It establishes the system topology, data flow, and non-negotiable constraints every module must follow.

---

## 1. System Identity

| Property | Value |
|---|---|
| **Product** | MK Paper Mill ERP |
| **Type** | Full-stack internal ERP (Paper Manufacturing) |
| **Stack** | Node.js + Express (backend) · React 18 + Vite (frontend) · PostgreSQL |
| **Deployment** | Single-server (PM2 process manager) · Production on port 5000 |
| **Auth** | JWT (Bearer token) · 8-hour expiry · bcryptjs password hashing |

---

## 2. High-Level Topology

```
Browser (React SPA)
  Vite + React 18 · react-router-dom v6 · lucide-react
  Port: 3333 (dev) / served from /dist (prod)
       |
       |  HTTP/REST  (Bearer JWT)  VITE_API_URL || ''
       v
Express API Server
  backend/src/server.js · Node >=18 · Port 5000
  Middleware stack (in order):
    1. CORS (locked to CORS_ORIGIN in production)
    2. express.json / express.urlencoded
    3. Prometheus metricsMiddleware
    4. authLimiter (IP-based rate limit on /api/auth, 50/15min)
    5. auth middleware (JWT verify + DB user lookup)
    6. Route handlers (28 route files)
    7. JSON error handler (last)
  Background crons (setInterval):
    * KPI Snapshot: every 1h  -> section_kpi_snapshots
    * PIIMAS Escalation: every 2h (indent ack overdue >24h)
       |
       |  pg (node-postgres Pool, max 20 connections)
       v
PostgreSQL Database
  Database: mk_paper_mill · Host: DB_HOST:5432
  Pool: max 20 conns · idleTimeout 30s · connectTimeout 2s

Optional Infrastructure:
  * Kafka (kafkajs) - event streaming
  * Prometheus (prom-client) - metrics at /metrics
  * File uploads: /uploads/hr, /uploads/maintenance (multer)
  * PDF generation: pdfkit
  * Excel import/export: xlsx
```

---

## 3. Directory Structure

```
MK Paper Mill/
├── backend/
│   ├── src/
│   │   ├── server.js          <- Entry point, all route mounting
│   │   ├── db/
│   │   │   ├── pool.js        <- pg Pool singleton (IMPORT THIS, never create new Pool)
│   │   │   └── init.js        <- DB bootstrap
│   │   ├── middleware/
│   │   │   ├── auth.js        <- JWT verify, requireLevel, requireStore
│   │   │   └── helpers.js     <- Shared route helpers
│   │   ├── routes/            <- 28 route files (one per module)
│   │   ├── kafka.js           <- Kafka producer/consumer
│   │   ├── metrics.js         <- Prometheus setup
│   │   └── public/            <- Dev progress dashboard HTML
│   ├── uploads/
│   │   ├── hr/                <- HR document uploads
│   │   └── maintenance/       <- Maintenance photos/scans
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx            <- Root shell + routing + notifications
│   │   ├── main.jsx           <- React entry
│   │   ├── components/        <- Shared UI (Sidebar, etc.)
│   │   ├── context/           <- AuthContext (JWT storage)
│   │   ├── data/              <- permissions.js, nav config
│   │   ├── hooks/             <- Custom React hooks
│   │   ├── pages/             <- 36 page components (one per module)
│   │   ├── styles/            <- Global CSS
│   │   └── theme/             <- Design tokens
│   └── package.json
├── db/
│   ├── schema.sql             <- Canonical schema (baseline)
│   └── migration_*.sql        <- Incremental migrations (never edit schema.sql directly)
├── docs/                      <- THIS FOLDER (AI reads before coding)
├── scripts/                   <- CLI tools (migrate, preflight, synccheck)
├── config/                    <- Env configs
└── ecosystem.config.js        <- PM2 process config
```

---

## 4. Authentication & Authorization

### JWT Flow
1. `POST /api/auth/login` -> validates email + bcrypt password -> signs JWT `{ userId }` -> 8h expiry
2. Every subsequent request: `Authorization: Bearer <token>` header
3. `auth` middleware: verifies token -> fetches full user row (id, name, role, role_level, permissions, dept_code, emp_id, is_dept_head)
4. Enriches `req.user` with derived flag `is_hr_admin = dept_code==='HR' && role_level>=3`

### Role Levels

| Level | Role | Capabilities |
|---|---|---|
| 1 | Operator | view, data entry |
| 2 | Shift Supervisor | + L1 approvals |
| 3 | Manager | + L2 approvals |
| 4 | Plant Head | + L3 approvals |
| 5 | Admin | full system access |

### Guard Middleware

| Middleware | When to use |
|---|---|
| `auth` | Every protected route (all routes except login) |
| `requireLevel(n)` | Checks `req.user.role_level >= n` |
| `requireStore` | **MANDATORY on all stock-deduction routes** - Only STORE dept OR level>=5 |

### Force Password Change
- Users with `must_change_password=true` are blocked on ALL routes except:
  - `/api/auth/change-password`
  - `/api/auth/me`
  - `/api/auth/logout`

---

## 5. API Conventions

- **Base path:** `/api/<module>`
- **All responses:** `{ success: boolean, data?: any, message?: string }`
- **Auth header:** `Authorization: Bearer <token>`
- **Error responses:** JSON only (never HTML) — enforced by last middleware
- **Rate limiting:** Auth endpoint: 50 requests per 15 minutes per IP (in-memory)
- **HTTP methods:** GET=read, POST=create, PUT=update/full-replace, PATCH=partial update, DELETE=soft-delete

---

## 6. Database Conventions

- **DB:** PostgreSQL · ORM: none (raw `pg` pool queries)
- **All queries:** parameterized (`$1`, `$2`, ...) — NEVER string concatenation
- **Timestamps:** `created_at TIMESTAMP DEFAULT NOW()`, `updated_at` where mutable
- **Soft deletes:** `is_active BOOLEAN DEFAULT true` — NEVER hard-delete users/materials/master data
- **Audit trail:** `store_indent_log` must be written in SAME transaction as any indent state change
- **Pool:** import from `../db/pool` — NEVER create new Pool instances in routes

---

## 7. Frontend Conventions

- **Framework:** React 18 (functional components + hooks only — no class components)
- **Routing:** State-based (single `active` state in App.jsx — no URL-based routing)
- **API calls:** `fetch()` with Bearer token from `localStorage.getItem('mk_token')`
- **API base:** `import.meta.env.VITE_API_URL || ''`
- **State:** Local useState/useEffect (no Redux/Zustand/MobX)
- **Icons:** lucide-react ONLY
- **Styling:** Inline styles (JS objects) — no CSS framework, no Tailwind

---

## 8. Critical Non-Negotiable Rules

> These rules must NEVER be violated.

1. `requireStore` guard MUST be on every route that deducts stock
2. Every indent state change MUST write to `store_indent_log` in the SAME DB transaction
3. Run impact analysis (`codegraph_impact`) BEFORE editing any function/class/method
4. NEVER string-concatenate SQL — always use parameterized queries
5. NEVER hard-delete users, materials, or master data — use `is_active=false`
6. JWT_SECRET MUST be set and >=32 chars in production — server refuses to start otherwise
7. NEVER create new pg Pool instances in route files — always import from `db/pool`

---

## 9. Background Jobs

| Job | Interval | What it does |
|---|---|---|
| KPI Snapshot | Every 1 hour | Aggregates section process readings -> `section_kpi_snapshots` |
| PIIMAS Escalation | Every 2 hours | Finds indents pending ack >24h -> notifies dept heads; auto-escalates >48h |

---

## 10. Module Count

| Layer | Count |
|---|---|
| Backend API route files | 28 |
| Frontend page components | 36 |
| Core business modules | ~24 |
| Departments (DB) | 20 |

---

*See sibling docs for details: 02_DEPENDENCY_MAP, 03_DATABASE_SCHEMA, 04_API_CONTRACTS, 05_WORKFLOWS, 06_CATALOG, 07_BUSINESS_ROLES, 08_DECISION_LOG, 09_CODING_STANDARDS*
