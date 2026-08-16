# MK Paper Mill — PaperMES Architecture

## System Overview
Full-stack ERP for 24×7 paper manufacturing plant. 20 modules, single PostgreSQL DB.

## Tech Stack
| Layer | Tech | Port |
|-------|------|------|
| Frontend | React 18 + Vite | 8787 |
| Backend | Node.js + Express | 5000 |
| Database | PostgreSQL | 5432 |
| Auth | JWT (localStorage: `mk_token`) | — |

## File Structure
```
C:\Project\MK Paper Mill\
├── backend\
│   └── src\
│       ├── server.js          ← Express entry, all routes mounted here
│       ├── db\
│       │   ├── pool.js        ← pg Pool, max 20 connections
│       │   └── init.js        ← schema + seed runner
│       ├── middleware\
│       │   └── auth.js        ← JWT verify, requireLevel(n)
│       └── routes\
│           ├── auth.js
│           ├── dashboard.js
│           ├── production.js
│           └── ... (one file per module)
├── frontend\
│   └── src\
│       ├── App.jsx            ← router + AuthProvider
│       ├── context\
│       │   └── AuthContext.jsx
│       ├── pages\
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   └── ... (one file per module)
│       └── components\
│           ├── Sidebar.jsx
│           └── ... shared components
├── db\
│   └── schema.sql             ← Full PostgreSQL schema
├── Documentation\             ← This folder
├── .cursorrules               ← AI coding rules
├── start.bat                  ← Kill old + start backend + frontend
└── stop.bat                   ← Kill both processes
```

## Auth Flow
1. POST `/api/auth/login` → JWT returned
2. Stored in `localStorage['mk_token']`
3. Every request: `Authorization: Bearer <token>` header
4. Middleware: `auth.js` verifies token, attaches `req.user`
5. Role guard: `requireLevel(n)` — 1=Operator, 2=Supervisor, 3=Manager, 4=PlantHead, 5=Admin

## Default Dev Credentials
- Email: `admin@mkpapermill.com`
- Password: `Admin@1234`

## Module Map
| # | Module | Route Prefix | DB Tables |
|---|--------|-------------|-----------|
| 01 | Auth | /api/auth | users, sessions |
| 02 | Dashboard | /api/dashboard | (aggregates) |
| 03 | Users / Master | /api/users, /api/master | users, departments, machines, grades, vendors, customers, materials |
| 04 | Production MES | /api/production | reels, shifts, machines, grades, downtime_entries, production_summary |
| 05 | Inventory | /api/inventory | materials, material_categories, stock_ledger, grn, grn_items |
| 06 | Indent | /api/indent | indents, indent_items |
| 07 | Purchase | /api/purchase | purchase_orders, po_items, vendors |
| 08 | Quality | /api/quality | quality_tests, reels |
| 09 | Maintenance | /api/maintenance | maintenance_schedule, maintenance_logs, downtime_entries |
| 10 | Sales | /api/sales | sales_orders, customers |
| 11 | Dispatch | /api/dispatch | dispatch_orders, dispatch_items, reels |
| 12 | Utility | /api/utility | utility_readings |
| 13 | HR | /api/hr | employees, attendance |
| 14 | Finance | /api/finance | — (future) |
| 15 | Reports | /api/reports | (aggregates all) |

## Cross-Module Sync Events
```
reel.completed     → deduct raw materials (Production→Inventory)
stock.below_reorder → suggest indent (Inventory→Indent)
grn.qc_approved    → post stock_ledger IN (Purchase→Inventory)
qc.reel_passed     → reel status=InWarehouse (Quality→Production)
breakdown.started  → downtime clock (Maintenance→Production)
sales_order.created → suggest production (Sales→Production)
dispatch.completed  → update SO fulfilled (Dispatch→Sales)
```

## Deployment (Future)
- PM2 ecosystem.config.js
- nginx reverse proxy on 443 → port 5000
- Certbot SSL
- PostgreSQL on same server, no Docker
