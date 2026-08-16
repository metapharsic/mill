# MK Paper Mill ERP — Module Dependency Tree

> **AI INSTRUCTION:** Read this before adding or refactoring code files in any module.
> Ensure that all new imports (`require` statements) and middleware chains match the declared 
> boundaries. Do not introduce circular dependencies between backend routes.

---

## 1. Core Shared Utility Dependencies

The entire backend framework is structured around a set of shared core dependencies:

```
                  ┌──────────────────────────────┐
                  │          database/pool       │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
                  │        middleware/auth       │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────┐
│  requireAuth    │     │  requireLevel   │     │  requireStore   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

*   **Database connection pool:** [pool.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/db/pool.js) — Single connection pool instance. Used by every single route. Never instantiate a new `pg.Pool` directly.
*   **Authentication & Access Control:** [auth.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/middleware/auth.js) — Extracts user attributes, handles token verification, sets `req.user.is_hr_admin`, and enforces the `must_change_password` gate.
*   **Route Wrappers:** [helpers.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/middleware/helpers.js) — Provides the `ar` (async route handler) wrapper to automatically catch errors and avoid app crashes on unhandled promise rejections.

---

## 2. Granular Route Dependency Map

Below is the file-level import and middleware tree for every active backend route file in the system.

### A. Operations & Telemetry

#### [production.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/production.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `kafka`
*   **Middlewares Used:** `auth`, `requireLevel(minLevel)`
*   **Database Tables:** `shifts`, `reels`, `downtime_entries`, `production_summary`, `daily_production_reports`, `dpr_gsm_breakup`, `dpr_chemical_lines`, `dpr_downtime_lines`, `dpr_grade_standards`, `shift_reports`, `chemical_consumption`, `materials`, `stock_ledger`
*   **Kafka Publications:** `TOPICS.DPR` (`dpr.saved`), `TOPICS.EVENTS_CRIT` (`dpr.chemical.alert`)

#### [dpsImport.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/dpsImport.js)
*   **Imports:** `express.Router`, `multer` (memoryStorage), `xlsx`, `db/pool`, `middleware/auth`, `kafka`
*   **Middlewares Used:** `auth`, `requireLevel(2)`
*   **Database Tables:** `machines`, `daily_production_reports`, `dpr_gsm_breakup`
*   **Kafka Publications:** `TOPICS.DPR` (`dpr.saved`)

#### [telemetry.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/telemetry.js)
*   **Imports:** `express.Router`, `middleware/helpers` (`pool`, `requireAuth`, `ar`), `kafka`
*   **Middlewares Used:** `requireAuth`
*   **Database Tables:** `section_process_readings`, `section_equipment`, `quality_lab_tests`, `boiler_performance_logs`, `section_energy_allocations`, `sections`
*   **Kafka Publications:** `TOPICS.TELEMETRY` (`reading`), `TOPICS.CORRELATION` (`correlation`), `TOPICS.LAB` (`lab`), `mkpm.telemetry.boiler` (`boiler.logged`), `mkpm.telemetry.energy` (`energy.allocated`)

#### [sections.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/sections.js)
*   **Imports:** `express.Router`, `middleware/helpers` (`pool`, `requireAuth`, `requireLevel`, `ar`)
*   **Middlewares Used:** `requireAuth`, `requireLevel(level)`
*   **Database Tables:** `plant_sections`, `section_process_readings`, `section_alarms`, `section_kpi_snapshots`
*   **Internal Helpers:** `hasSectionWriteAccess(user, sectionCode)` — enforces department-specific write constraints on process readings.

---

### B. Materials & Inventory

#### [indent.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/indent.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `kafka`
*   **Middlewares Used:** `auth`, `requireLevel(level)`, `requireStore` (for stock issue endpoint)
*   **Database Tables:** `indents`, `indent_items`, `approval_matrix`, `materials`, `stock_ledger`, `indent_audit_log`, `store_indent_log`
*   **Kafka Publications:** `mkpm.indent.events` (`indent.*`)

#### [inventory.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/inventory.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `kafka`
*   **Middlewares Used:** `auth`, `requireLevel(level)`, `requireStore`
*   **Database Tables:** `material_categories`, `materials`, `grn`, `grn_items`, `stock_ledger`
*   **Kafka Publications:** `TOPICS.EVENTS_CRIT` (`stock.*.high`)

#### [store.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/store.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `kafka`
*   **Middlewares Used:** `auth`, `requireLevel(level)`, `requireStore` (for adjustments & returns)
*   **Database Tables:** `store_issues`, `materials`, `stock_ledger`, `installed_assets`, `machine_positions`, `store_indent_log`
*   **Kafka Publications:** `TOPICS.EVENTS_ALL` (`store.issue.created`, `store.issue.approved`, `store.issue.rejected`), `TOPICS.EVENTS_CRIT` (`stock.*.high`)

#### [chemicals.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/chemicals.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `multer` (diskStorage), `path`, `fs`
*   **Middlewares Used:** `auth`, `requireStore`, `requireLevel(level)`
*   **Database Tables:** `chemical_inventory`, `chemical_transactions`
*   **File Uploads:** Save path `backend/uploads/msds/`

---

### C. Purchase, Sales & Warehouse

#### [purchase.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/purchase.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `kafka`
*   **Middlewares Used:** `auth`, `requireLevel(level)`
*   **Database Tables:** `vendors`, `purchase_orders`, `po_items`, `grn`
*   **Kafka Publications:** `TOPICS.EVENTS_ALL` (`purchase.order.created`, `purchase.order.updated`, `purchase.order.approved`)

#### [sales.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/sales.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `kafka`
*   **Middlewares Used:** `auth`, `requireLevel(level)`
*   **Database Tables:** `customers`, `sales_orders`, `grades`, `dispatch_orders`, `dispatch_items`, `reels`
*   **Kafka Publications:** `TOPICS.EVENTS_ALL` (`sales.order.created`, `sales.order.updated`, `sales.order.confirmed`, `sales.dispatch.created`)

#### [warehouse.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/warehouse.js)
*   **Imports:** `express.Router`, `middleware/helpers` (`pool`, `requireAuth`, `requireLevel`, `ar`)
*   **Middlewares Used:** `requireAuth`, `requireLevel(level)`
*   **Database Tables:** `reels`, `grades`, `packing_records`

---

### D. HR, Finance & Administration

#### [hr.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/hr.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `multer` (diskStorage), `pdfkit`, `path`, `fs`
*   **Middlewares Used:** `auth`, `requireLevel(level)`
*   **Database Tables:** `employees`, `attendance`, `payroll`, `payroll_items`, `leaves`, `leave_balances`, `holidays`, `employee_loans`, `loan_repayments`, `hr_documents`, `notifications`
*   **File Uploads:** Save path `backend/uploads/hr/`

#### [finance.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/finance.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `kafka`
*   **Middlewares Used:** `auth`, `requireLevel(level)`
*   **Database Tables:** `finance_ledger`, `payments`, `purchase_orders`, `sales_orders`, `payroll`
*   **Kafka Publications:** `TOPICS.EVENTS_ALL` (`finance.payment.recorded`)

#### [admin.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/admin.js)
*   **Imports:** `express.Router`, `db/pool`, `middleware/auth`, `bcrypt`
*   **Middlewares Used:** `auth`, `requireLevel(level)` (Strict Level 5 enforced for mutations)
*   **Database Tables:** `users`, `roles`, `departments`, `audit_log`

---

## 3. Frontend Architecture Dependencies

The React frontend handles configuration dependencies explicitly using React Context.

```
       ┌──────────────────────────────────────────────┐
       │             App.jsx (Main Shell)             │
       └──────────────────────┬───────────────────────┘
                              │
       ┌──────────────────────▼───────────────────────┐
       │                 AuthContext                  │
       └──────────────────────┬───────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│  Dashboard.jsx  │  │   Sidebar.jsx   │  │   HR/Prod/etc   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

*   **AuthContext.jsx:** Provides the session state (`user`, `login`, `logout`) via React Context to all pages.
*   **permissions.js:** Filters the sidebar navigation tree using:
    ```javascript
    import { filterNav } from '../data/permissions';
    const allowedNav = filterNav(user);
    ```
*   **useApi.js:** Central fetch module. Attaches the JWT authorization header to every outbound API query and formats the response JSON.
*   **phaseStatus.js:** Large static JSON file defining standard phase checklists, thresholds, and guide cards.

---

## 4. Summary of System Dependency Matrix

| Module | Entry Route | Code Imports | Critical Downstream Systems |
|---|---|---|---|
| **Production** | `/api/production` | `db/pool`, `auth`, `kafka` | In-process testing, stock deductions |
| **Quality** | `/api/quality` | `db/pool`, `auth` | Reel release, warehouse storage |
| **Maintenance** | `/api/maintenance` | `db/pool`, `auth`, `multer`, `xlsx`, `kafka` | Bearing thermal scan file uploads |
| **Utility** | `/api/utility` | `db/pool`, `auth` | DPR metrics autofill, telemetry |
| **Inventory** | `/api/inventory` | `db/pool`, `auth`, `kafka` | Raw material stock checking, ledger |
| **Indent** | `/api/indent` | `db/pool`, `auth`, `kafka` | Store stock ledger issues, audit |
| **Store** | `/api/store` | `db/pool`, `auth`, `kafka` | Serialized installed assets, audit log |
| **Purchase** | `/api/purchase` | `db/pool`, `auth`, `kafka` | Inward GRN creation, PO item balances |
| **Sales** | `/api/sales` | `db/pool`, `auth`, `kafka` | Customer dispatch operations, billing |
| **Warehouse** | `/api/warehouse` | `db/pool`, `auth` | Reel labeling, packing records |
| **HR & Payroll** | `/api/hr` | `db/pool`, `auth`, `multer`, `pdfkit` | Payslip PDF streaming, HR doc uploads |
| **Finance** | `/api/finance` | `db/pool`, `auth`, `kafka` | General journal entries, payment audit |
| **Laboratory** | `/api/laboratory` | `db/pool`, `auth` | Wet end chemical status reports |
| **EHS** | `/api/ehs` | `db/pool`, `auth` | Accident LTI notifications |
| **Security** | `/api/security` | `db/pool`, `auth`, `kafka` | Gate pass dispatch verification |
| **Chemicals** | `/api/chemicals` | `db/pool`, `auth`, `multer` | MSDS document uploads, batch tracking |
| **Plant Sections** | `/api/sections` | `db/pool`, `auth` | Real-time alarms, KPI snapshot cron |
| **Admin** | `/api/admin` | `db/pool`, `auth`, `bcrypt` | Password reset, audit log trail |
| **Reports** | `/api/reports` | `db/pool`, `auth` | CSV download streams |
