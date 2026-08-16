# MK Paper Mill ERP — Module Integration Map

> **AI INSTRUCTION:** Read this before adding a feature that spans modules.
> Shows which modules share tables, which produce data others consume,
> and which Kafka events flow between them.

---

## Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW DIAGRAM                           │
│                                                                     │
│  PURCHASE → GRN → INVENTORY/STORE ←──── INDENT ←─── All Depts      │
│                         │                                           │
│                    stock_ledger                                     │
│                         │                                           │
│  PRODUCTION ────────────┘   (auto-deduct pulp/chemicals on reel)   │
│       │                                                             │
│    reels                                                            │
│       │                                                             │
│    QUALITY  ────── Pass ──→  FG WAREHOUSE ──→ SALES/DISPATCH        │
│       │                                                             │
│    Fail ──→ Rejected reels → SCRAP                                 │
│                                                                     │
│  HR → FINANCE (payroll payments)                                   │
│  SALES → FINANCE (receivables)                                     │
│  PURCHASE → FINANCE (payables)                                     │
│  UTILITY → PRODUCTION DPR (autofill)                               │
│  SECTIONS → KPI Snapshots (hourly cron)                            │
│  SECURITY → SALES (gate timestamp = official dispatch time)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Shared Tables (Cross-Module Usage)

> ⚠️ These tables are read/written by multiple modules — coordinate changes carefully.

| Table | Owned By | Also Read/Written By |
|---|---|---|
| `reels` | Production | Quality (update quality_status), Sales (sales_order_id), Warehouse (status filter), Reports |
| `stock_ledger` | Inventory/Store | Production (auto-deduct), Indent (issue), Chemicals, all deduction flows |
| `materials` | Inventory | Store (current_stock updates), Chemicals, Production (auto-deduct), Indent (price lookup) |
| `shifts` | Production | Reports (join for summaries) |
| `machines` | Production | Maintenance (machine_id FK), Sections (section per machine), Quality, Downtime |
| `grades` | Production | Sales (grade_id on SO), Quality (grade code for DPR standards), Warehouse (grade filter) |
| `departments` | Admin | HR (dept FK), Indent (department_id), Users, Sections (dept_code) |
| `users` | Admin | Every module (created_by, approved_by, issued_by, etc.) |
| `audit_log` | Multiple | Production, Quality, Admin — all write here for audit trail |
| `notifications` | HR / Sections / Indent | App.jsx polls every 60s via `/api/hr/notifications` |
| `employees` | HR | Auth middleware (emp_id lookup on every request) |
| `grn` | Inventory | Purchase (po_id), Quality (reference_type=GRN) |
| `purchase_orders` | Purchase | Inventory/GRN (po_id FK), Finance (payables) |

---

## Module-to-Module Dependencies

### Production → Quality
- **Trigger:** Reel created with `status='In Production'`
- **What happens:** Quality team creates `quality_tests` with `reference_type='Reel'`, `reference_id=reel.id`
- **Table:** `quality_tests.reference_id` → `reels.id`
- **Side effect:** Pass → `reels.quality_status='Approved'`, `reels.status='In Warehouse'`

### Production → Inventory/Store (Auto)
- **Trigger:** `POST /production/reels` (when weight_kg > 0)
- **What happens:** Server auto-deducts Pulp (90%) + Additive chemical (2%) from `materials.current_stock`
- **Table:** `stock_ledger` INSERT + `materials` UPDATE inside SAME transaction
- **Rule:** This is automatic — store staff do not manually issue for production raw material

### Quality → FG Warehouse
- **Trigger:** Quality test marked Pass
- **What happens:** `reels.status` changes to `'In Warehouse'`
- **Table:** `reels` UPDATE
- **FG Warehouse query:** `WHERE r.status = 'In Warehouse'` — no separate table needed

### FG Warehouse → Sales/Dispatch
- **Trigger:** Sales team creates dispatch order
- **What happens:** Reel linked to dispatch_items, `reels.status` = `'Dispatched'`, `sales_orders.fulfilled_mt` updated
- **Table:** `dispatch_items.reel_id` → `reels.id`

### Indent → Store (Issue Flow)
- **Trigger:** `PUT /indent/:id/issue`
- **What happens:** `materials.current_stock` deducted, `stock_ledger` INSERT, `indent_items.issued_qty` SET
- **Tables:** `materials` + `stock_ledger` + `indent_items` + `indent_audit_log` — all in ONE transaction

### Purchase → Inventory (GRN Flow)
- **Trigger:** GRN approval (`PUT /inventory/grn/:id/approve`)
- **What happens:** `materials.current_stock` increased, `stock_ledger` INSERT (type=GRN)
- **Table:** `grn.po_id` → `purchase_orders.id`

### HR → Finance
- **Trigger:** Payroll approved
- **What happens:** Finance team manually records payment referencing payroll
- **Table:** `payments.reference_type='Salary'`, `payments.reference_id=payroll.id`

### Purchase → Finance
- **Trigger:** GRN approved (goods received)
- **What happens:** Finance records vendor payable
- **Table:** `payments.reference_type='PO'`, `payments.reference_id=purchase_orders.id`

### Sales → Finance
- **Trigger:** Dispatch completed
- **What happens:** Finance records customer receivable
- **Table:** `payments.reference_type='Sales'`

### Utility → Production DPR
- **Trigger:** `GET /production/daily-report/autofill`
- **What happens:** DPR form pre-filled with utility_readings data for that date
- **Query:** `SUM(power_units)`, `SUM(steam_generated_mt)`, `SUM(coal_consumed_kg)` from `utility_readings WHERE date=$1`

### Production → DPR (via Reels)
- **Trigger:** `GET /production/daily-report/autofill`
- **What happens:** PMC production = `SUM(reels.weight_kg)/1000`, Finish = QC-Approved reels only
- **Query:** Aggregates from `reels WHERE DATE(start_time)=$1`

### Security → Sales
- **Trigger:** Dispatch vehicle exit gate
- **What happens:** `gate_logs.out_time` becomes official dispatch timestamp
- **Integration:** Manual — security logs vehicle out, sales checks gate log for delivery proof

### Sections → KPI Snapshots (Cron)
- **Trigger:** `setInterval` every 1 hour in `server.js`
- **What happens:** Aggregates `section_process_readings` → inserts into `section_kpi_snapshots`
- **Tables:** `section_process_readings` (read) → `section_kpi_snapshots` (write)

---

## Kafka Event Flow

```
INDENT module (mkpm.indent.events):
  indent.created → [no consumer yet, for future workflow engine]
  indent.approved → [triggers notification]
  indent.issued → [triggers PIIMAS ack tracking]
  indent.closed → [triggers completion metrics]

STORE module (TOPICS.EVENTS_ALL):
  store.issue.created → [for audit]
  stock.outward.high / stock.inward.high → [TOPICS.EVENTS_CRIT → notify L3+ STORE + L4+]

MAINTENANCE module (TOPICS.EVENTS_ALL):
  maintenance.schedule.created → [for notification]
  maintenance.schedule.updated → [for notification]

SALES module (TOPICS.EVENTS_ALL):
  sales.order.created → [for pipeline visibility]
  sales.order.confirmed → [production planning trigger]
  sales.dispatch.created → [for logistics]
```

> [!NOTE]
> Kafka is **optional** — all publish calls are wrapped in try-catch. System works fully without Kafka broker configured.

---

## Frontend Route → API Dependency Map

| Page / State Key | Primary APIs Called |
|---|---|
| `dashboard` | `/production/oee`, `/production/summary`, `/production/reels`, `/sections/all/kpi-snapshot`, `/hr/notifications` |
| `production` | `/production/shifts`, `/production/reels`, `/production/machines`, `/production/grades`, `/production/downtime` |
| `daily-report` | `/production/daily-report`, `/production/daily-report/autofill`, `/production/daily-report/list` |
| `quality` | `/quality/tests`, `/quality/stats` |
| `maintenance` | `/maintenance/schedule`, `/maintenance/logs`, `/maintenance/equipment`, `/maintenance/bearing-rounds` |
| `inventory` | `/inventory/materials`, `/inventory/categories`, `/inventory/grn`, `/inventory/ledger` |
| `indent` | `/indent`, `/indent/:id/tier`, `/indent/analytics/summary`, `/indent/calendar`, `/indent/my-acks` |
| `store` | `/store/rawmaterials`, `/store/issues`, `/store/grn`, `/store/stock`, `/store/ledger` |
| `purchase` | `/purchase/orders`, `/purchase/vendors`, `/purchase/grn` |
| `sales` | `/sales/orders`, `/sales/customers`, `/sales/dispatch` |
| `hr` | `/hr/employees`, `/hr/attendance`, `/hr/leaves`, `/hr/payroll`, `/hr/holidays`, `/hr/loans` |
| `utility` | `/utility/readings`, `/utility/summary` |
| `sections` | `/sections`, `/sections/:code/readings`, `/sections/:code/alarms`, `/sections/:code/kpi-history` |
| `chemicals` | `/chemicals/inventory`, `/chemicals/transactions`, `/chemicals/dosing-report`, `/chemicals/expiry-alerts` |
| `reports` | `/reports/production`, `/reports/inventory`, `/reports/quality`, `/reports/maintenance`, `/reports/utility` |
| `admin` | `/admin/users`, `/admin/roles`, `/admin/departments`, `/admin/audit-log` |

---

## Table Ownership Summary

> Rule: Only the owning module should write to a table. Others only read (via JOINs).

| Table | Owner | Readers |
|---|---|---|
| `reels` | Production | Quality (W: quality_status, status), Sales (W: sales_order_id), Warehouse (R), Reports (R) |
| `quality_tests` | Quality | Reports (R) |
| `maintenance_schedule` | Maintenance | — |
| `maintenance_logs` | Maintenance | Reports (R) |
| `indents`, `indent_items` | Indent | Store (W: issued_qty on issue), Reports (R) |
| `store_issues` | Store | — |
| `stock_ledger` | Inventory | Production (W), Store (W), Indent (W), Inventory (W) |
| `materials` | Inventory | Store (W: current_stock), Production (W: current_stock), Indent (R: unit_price) |
| `grn`, `grn_items` | Inventory | Purchase (W: po_id), Quality (W: status on QC pass) |
| `purchase_orders` | Purchase | Inventory (R: po_id), Finance (R) |
| `sales_orders` | Sales | Production (W: sales_order_id on reel), Finance (R) |
| `employees` | HR | Auth middleware (R: emp_id, is_dept_head) |
| `payroll` | HR | Finance (R: reference) |
| `attendance` | HR | Reports (R) |
| `utility_readings` | Utility | Production DPR (R: autofill) |
| `section_process_readings` | Sections | KPI cron (R: aggregate) |
| `section_kpi_snapshots` | Cron (server.js) | Sections (R: display), Dashboard (R) |
| `audit_log` | Multiple (shared write) | Admin (R: display) |
| `notifications` | Multiple (shared write) | App.jsx (R: poll every 60s) |
