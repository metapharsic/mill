# MK Paper Mill ERP — Module Catalog

> Complete inventory of all modules: purpose, backend route, frontend page, key tables, and status.

---

## Module Index

| # | Module | Backend Route | Frontend Page | Core Tables | Status |
|---|---|---|---|---|---|
| 1 | Dashboard | `/api/dashboard` | `Dashboard.jsx` | production_summary, reels, utility_readings | Active |
| 2 | Production | `/api/production` | `Production.jsx` | reels, shifts, downtime_entries, production_summary | Active |
| 3 | Daily Report | `/api/production/dpr` | `DailyReport.jsx` | daily_production_report, reels, shifts | Active |
| 4 | Quality | `/api/quality` | `Quality.jsx` | quality_tests | Active |
| 5 | Maintenance | `/api/maintenance` | `Maintenance.jsx` | maintenance_schedule, maintenance_logs, equipment | Active |
| 6 | Utility | `/api/utility` | `Utility.jsx` | utility_readings | Active |
| 7 | Raw Material Store | `/api/master` (materials) | `RawMaterial.jsx` | materials, stock_ledger | Active |
| 8 | Inventory | `/api/inventory` | `Inventory.jsx` | grn, grn_items, stock_ledger, materials | Active |
| 9 | Store Management | `/api/store` | `Store.jsx` | store_indent_log, stock_ledger, indents | Active |
| 10 | Indent / PIIMAS | `/api/indent` | `Indent.jsx` | indents, indent_items | Active |
| 11 | Scrap | `/api/scrap` | `Scrap.jsx` | scrap_records | Active |
| 12 | Purchase | `/api/purchase` | `Purchase.jsx` | purchase_orders, po_items, vendors | Active |
| 13 | Sales | `/api/sales` | `Sales.jsx` | sales_orders, customers | Active |
| 14 | Dispatch | `/api/sales` (dispatch) | `Sales.jsx` (tab) | dispatch_orders, dispatch_items | Active |
| 15 | Finance | `/api/finance` | `Finance.jsx` | finance_ledger, payments | Active |
| 16 | Packing | N/A (frontend only) | `Packing.jsx` | reels, dispatch | Active |
| 17 | FG Warehouse | `/api/warehouse` | `FGWarehouse.jsx` | reels, rack_location | Active |
| 18 | HR & Payroll | `/api/hr` | `HR.jsx` | employees, attendance, payroll, leaves | Active |
| 19 | Security | `/api/security` | `Security.jsx` | gate_log, visitors | Active |
| 20 | Laboratory | `/api/laboratory` | `Laboratory.jsx` | lab_tests | Active |
| 21 | EHS | `/api/ehs` | `EHS.jsx` | incidents, compliance | Active |
| 22 | Chemical Store | `/api/chemicals` | `ChemicalStore.jsx` | chemical_stock, chem_ledger | Active |
| 23 | Reports | `/api/reports` | `Reports.jsx` | (aggregates all) | Active |
| 24 | Plant Sections | `/api/sections` | `PlantSection.jsx` | plant_sections, section_process_readings | Active |
| 25 | Master Data | `/api/master` | `MasterData.jsx` | materials, machines, grades, departments | Active |
| 26 | Grades | `/api/master` (grades) | `Grades.jsx` | grades | Active |
| 27 | Machines | `/api/master` (machines) | `Machines.jsx` | machines | Active |
| 28 | Materials | `/api/master` (materials) | `Materials.jsx` | materials, material_categories | Active |
| 29 | Customers | `/api/master` (customers) | `Customers.jsx` | customers | Active |
| 30 | Vendors | `/api/master` (vendors) | `Vendors.jsx` | vendors | Active |
| 31 | Users | `/api/users` | `Users.jsx` | users, roles, departments | Active |
| 32 | Admin | `/api/admin` | `Admin.jsx` | users, roles, audit_log | Active |
| 33 | Phases | `/api/master` (phases) | `Phases.jsx` | production_phases | Active |
| 34 | Telemetry | `/api/telemetry` | PlantSection.jsx | section_process_readings | Active |
| 35 | Events | `/api/events` | (internal) | events | Active |
| 36 | All Sections | `/api/sections` | `AllSections.jsx` | plant_sections | Active |

---

## Module Detail Cards

### Dashboard
- **Purpose:** Single-screen KPI view for all roles
- **Key Features:** Production output today, quality reject rate, active alerts, utility consumption, pending indents
- **Key Data:** Queries across production_summary, reels, quality_tests, utility_readings, indents
- **Access:** All authenticated users

---

### Production
- **Purpose:** Core paper production data entry and monitoring
- **Key Features:** Shift management, reel logging, downtime tracking, production summary
- **Entry Point:** `Production.jsx` -> tabs for Shifts, Reels, Downtime, Summary
- **Workflow:** Operator creates shift -> logs reels -> logs downtime -> QC picks up
- **Key Rules:** Reel status must follow the lifecycle sequence (see 05_WORKFLOWS)

---

### Daily Report (DPS)
- **Purpose:** Import and display Daily Production Summary from Excel
- **Key Features:** Excel upload (DPS format), parsed and stored, viewable in UI
- **Backend:** `dpsImport.js` handles multipart form data (multer + xlsx)
- **Access:** L2+

---

### Quality
- **Purpose:** Paper quality testing, incoming inspection, and release
- **Key Features:** Test parameter entry, pass/fail/hold result, reel release
- **Key Rules:** Only L3+ can approve quality tests; failed reels must be marked Rejected

---

### Maintenance (CMMS)
- **Purpose:** Preventive, predictive, and breakdown maintenance management
- **Key Features:** Equipment registry, maintenance schedule, work logs, bearing checks, spare parts tracking, photo uploads
- **File Storage:** `/uploads/maintenance/`
- **Key Tables:** maintenance_schedule, maintenance_logs, equipment_bearing_checks
- **Access:** Maintenance dept + L3+ for scheduling

---

### Utility
- **Purpose:** Track energy, water, steam consumption per shift
- **Key Features:** Manual reading entry, trend charts, KPI snapshots
- **Automated:** Section KPI cron aggregates readings hourly

---

### Inventory / GRN
- **Purpose:** Goods receipt, stock tracking, and item ledger
- **Key Features:** GRN creation from PO, QC of received goods, stock ledger, bin location
- **Key Rule:** Never manipulate stock_ledger directly — always use GRN/issue/adjustment flows

---

### Indent / PIIMAS
- **Purpose:** Internal material requisition system with multi-level approval
- **Key Features:** Dept raises indent -> L1/L2/L3 approval chain -> Store issues -> Dept acknowledges
- **Critical Rules:**
  - requireStore on all issue routes
  - store_indent_log written in same transaction as issue
  - PIIMAS escalation cron notifies on >24h pending ack

---

### Store Management
- **Purpose:** Central store for all materials (spares, consumables, chemicals)
- **Key Features:** Issue to departments, receive from GRN, adjustment, shift tracking
- **Access:** STORE dept or level>=5 for deduction operations

---

### Purchase
- **Purpose:** Vendor purchase order management
- **Key Features:** PO creation from indent, vendor selection, delivery tracking, PO approval
- **Workflow:** Indent L3 Approved -> PO Draft -> PO Approved -> Sent -> GRN

---

### HR & Payroll
- **Purpose:** Employee lifecycle, attendance, leave, and salary processing
- **Key Features:** Employee profile, attendance marking, leave management, payroll generation, payslip PDF, PF/ESIC calculation
- **File Storage:** `/uploads/hr/`
- **Special Auth:** `is_hr_admin` flag (HR dept + role_level>=3)
- **Notifications:** PIIMAS escalation routes through HR notification system

---

### Sales & Dispatch
- **Purpose:** Customer order fulfillment and reel dispatch
- **Key Features:** Sales order creation, reel assignment, dispatch order, e-way bill tracking
- **Key Rule:** Only QC-Approved reels can be dispatched

---

### Finance
- **Purpose:** Financial entries, payment tracking, expense logging
- **Key Features:** Journal entries, payment confirmation, financial reports
- **Access:** L3+ for viewing, L4+ for payment confirmation

---

### Reports
- **Purpose:** Cross-module reporting and data export
- **Key Features:** Production reports, quality trends, inventory valuation, HR reports, financial summaries
- **Output:** JSON (for charts), PDF (pdfkit), Excel (xlsx)

---

### Admin
- **Purpose:** System administration
- **Key Features:** User management, role assignment, audit log viewing, password reset
- **Access:** Level 5 (Admin) only

---

### Plant Sections / Telemetry
- **Purpose:** Real-time monitoring of plant sections (e.g., PM1, PM2, Boiler, ETP)
- **Key Features:** Live process readings, alarms, KPI charts, section comparison
- **Tables:** plant_sections, section_process_readings, section_alarms, section_kpi_snapshots
- **Automated:** KPI snapshot cron runs every hour

---

## Module Dependency Map

```
Dashboard <- (reads from all modules)
Production -> Quality -> FG Warehouse -> Dispatch
Indent -> Store -> (deducts from) Inventory -> (GRN from) Purchase
HR -> (uses) Users/Departments
Finance <- (triggered by) Purchase, Sales, HR/Payroll
Reports <- (aggregates from) all modules
Admin -> (manages) Users, Roles
Sections -> (feeds) Telemetry -> Dashboard
```

---

*Last updated: 2026-07-17 | See individual module docs in /docs/modules/*
