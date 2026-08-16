# MK Paper Mill ERP — Dependency Map

> Inventory of all libraries used, their purpose, and upgrade notes.
> Read this before adding new packages to avoid duplication.

---

## Backend Dependencies (`backend/package.json`)

| Package | Version | Purpose | Notes |
|---|---|---|---|
| `express` | ^4.19.2 | HTTP server framework | Core — all routes extend express.Router() |
| `pg` | ^8.12.0 | PostgreSQL client | Uses connection Pool — import from `db/pool.js` only |
| `jsonwebtoken` | ^9.0.2 | JWT sign/verify | Secret from `JWT_SECRET` env var |
| `bcryptjs` | ^2.4.3 | Password hashing | saltRounds=10 on new passwords |
| `cors` | ^2.8.5 | CORS middleware | Production: locked to `CORS_ORIGIN` env var |
| `dotenv` | ^16.4.5 | Env var loader | Called at top of server.js and pool.js |
| `multer` | ^2.2.0 | File upload handling | Used in HR (docs) and Maintenance (photos) |
| `pdfkit` | ^0.19.1 | PDF generation | Used in reports and payslip generation |
| `xlsx` | ^0.18.5 | Excel read/write | Used in DPS import and inventory export |
| `kafkajs` | ^2.2.4 | Kafka event streaming | Optional — configured via env vars |
| `prom-client` | ^15.1.3 | Prometheus metrics | Exposes /metrics endpoint |
| `uuid` | ^10.0.0 | UUID generation | For unique reference IDs |
| `nodemon` | ^3.1.4 | Dev auto-reload | devDependency only |

### Node Version Requirement
- **Minimum:** Node.js >= 18.0.0

---

## Frontend Dependencies (`frontend/package.json`)

| Package | Version | Purpose | Notes |
|---|---|---|---|
| `react` | ^18.3.1 | UI framework | Hooks-only, no class components |
| `react-dom` | ^18.3.1 | React DOM renderer | |
| `react-router-dom` | ^6.26.0 | Routing (imported but state-based routing used) | `useNavigate` not used — App.jsx uses `active` state |
| `lucide-react` | ^0.436.0 | Icon library | **ONLY icon library** — do not add others |
| `vite` | ^5.4.1 | Build tool + dev server | Config in `vite.config.js` |
| `@vitejs/plugin-react` | ^4.3.1 | Vite React plugin | |

### Dev Server
- Dev: `npm run dev` -> Vite on port 5173
- Build: `npm run build` -> output to `frontend/dist/`
- Production: Express serves `/dist` as static files

---

## Infrastructure Dependencies

| Tool | Version | Purpose |
|---|---|---|
| PostgreSQL | 14+ | Primary database |
| PM2 | latest | Process management (`ecosystem.config.js`) |
| Apache Kafka | optional | Event streaming |
| Prometheus | optional | Metrics collection |

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `production` locks CORS + requires strong JWT |
| `PORT` | No | `5000` | HTTP server port |
| `JWT_SECRET` | **Yes (prod)** | insecure default | MUST be >=32 chars in production |
| `JWT_EXPIRES_IN` | No | `8h` | Token TTL |
| `DB_HOST` | No | `localhost` | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_NAME` | No | `mk_paper_mill` | Database name |
| `DB_USER` | No | `postgres` | DB user |
| `DB_PASSWORD` | No | `postgres` | DB password |
| `CORS_ORIGIN` | No (prod) | `''` | Comma-separated allowed origins |

### Frontend (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `''` (same origin) | Backend API base URL |

---

## Adding New Packages — Rules

1. **Backend:** `cd backend && npm install <pkg>` — document it in this file
2. **Frontend:** `cd frontend && npm install <pkg>` — document it in this file
3. **Check first:** Does an already-installed package do the job? (e.g., use `xlsx` for Excel, not `exceljs`)
4. **No CSS frameworks** on frontend — inline styles only per coding standards
5. **No ORM** on backend — raw pg queries only

---

*Last updated: 2026-07-17 | See 01_ARCHITECTURE for system overview*
