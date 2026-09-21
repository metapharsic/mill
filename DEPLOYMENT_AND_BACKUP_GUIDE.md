# MK Paper Mill ERP — Complete Deployment & Standalone Backup Guide

## 1. Overview & System Architecture

This repository contains the complete, production-grade source code, relational database schema, seed data, and operational logic for the **MK Paper Mill ERP** system.

```
                                  MK PAPER MILL ERP ARCHITECTURE
                                  
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                                  FRONTEND (React + Vite)                               │
   │  • Store Management & PIIMAS Indent/Issuance    • Procurement & P2P Full Lifecycle     │
   │  • Raw Material & Finished Goods Stock          • Finance AP / AR & Payment Ledgers    │
   │  • Production DPR, Machine Reels & Alarms       • Executive Analytics & WhatsApp EOD   │
   └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                               │ HTTP / REST API (Port 5000)
   ┌───────────────────────────────────────────▼────────────────────────────────────────────┐
   │                                   BACKEND (Node.js + Express)                          │
   │  • Store DML & Atomic Stock Guard               • Advisory-Locked Sequences (PO/GRN/IND)│
   │  • 3-Way Match & Commercial Bill Invoicing      • Granular Department Audit & Logging  │
   └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                               │ pg Connection Pool (Port 5432)
   ┌───────────────────────────────────────────▼────────────────────────────────────────────┐
   │                              DATABASE (PostgreSQL 14+)                                 │
   │  • 101 Relational Tables (materials, indents, purchase_orders, grn, vendor_bills, etc.)│
   │  • Zero-Hardcoding Live Valuation & Aggregation Queries                                │
   └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backup Bundle Manifest

All data and logic are bundled in the workspace:

| Folder / File Path | Description | Contents / Purpose |
| :--- | :--- | :--- |
| `Backup_Database/` | **Daily Multi-Agent Backups & Excel Reports** | Automated daily 9:00 PM PostgreSQL database dumps (`.sql`) and 5 comprehensive domain Excel workbooks (`.xlsx`) with cryptographic SHA-256 manifests. |
| `Backup_Database/Latest_Backup/` | **Fast-Access Latest Backup Mirror** | Always points to the most recent SQL database dump (`mkmill_pg_backup_latest.sql`) and latest Excel reports. |
| `setup_backup_scheduler.bat` | **1-Click 9:00 PM Scheduler Setup** | Automatically registers/configures the daily 9:00 PM Windows Scheduled Task (`MK_Paper_Mill_Daily_Backup`). |
| `run_backup_now.bat` | **1-Click Immediate Backup Runner** | Runs the full 7-agent backup and reporting engine on demand with real-time colored progress. |
| `database_backup/mk_paper_mill_full_dump.sql` | **Full PostgreSQL SQL Dump** | Schema, tables, sequences, foreign keys, triggers, and live material rows. |
| `database_backup/json_tables/` | **Portable JSON Table Exports** | 101 JSON files representing every relational table for universal DB portability. |
| `frontend/` | **Client Application** | React 18, Vite, Lucide Icons, dynamic modals, responsive print templates. |
| `backend/` | **API Server & Business Logic** | Express server, REST endpoints, database pool, Kafka integration, and tests. |
| `docs/` | **System Specifications** | Complete workflow documentation, schema diagrams, and operational procedures. |
| `Projects_Requirement/` | **Source Requirements** | Reference spreadsheets and plant specifications. |
| `scripts/` | **Automation & Launchers** | `run-app.ps1`, `stop-app.ps1`, background watchdog, and service verifiers. |
| `Start MK Paper Mill.vbs` | **1-Click Windows Launcher** | Launches backend, frontend, verifies health, and opens default web browser. |
| `start.bat` / `stop.bat` | **Command-line Launchers** | Start and stop batch scripts for Windows terminals. |

---

## 3. Fresh Machine Deployment Steps (Step-by-Step)

To deploy this complete system to any new machine or server:

### Step 1: Install Prerequisites
Ensure the target computer has the following installed:
1. **Node.js**: v18.x or v20.x LTS ([nodejs.org](https://nodejs.org))
2. **PostgreSQL**: v14, v15, v16, or v18 ([postgresql.org](https://www.postgresql.org))

### Step 2: Copy Repository to Target Machine
Copy the entire `mkmill_complete_backup` directory to your desired location, e.g.:
`C:\MK_Paper_Mill\mkmill_complete_backup` or `/opt/mk_paper_mill`.

### Step 3: Install Node.js Dependencies
Open PowerShell or Command Prompt in the project folder and run:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
npm run build
cd ..
```

### Step 4: Configure Database & Environment
1. In `backend/.env`, confirm your PostgreSQL credentials:
   ```env
   PORT=5000
   NODE_ENV=production
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=mk_paper_mill
   DB_USER=postgres
   DB_PASSWORD=postgres
   JWT_SECRET=636aa785a372c1c2609656748d1304e08a3ab771d97f21098ce6f68f815b33e9a5937f73aec4e41c957300fead3ce3d0bb68829c691c148f724c85ffc6404395
   JWT_EXPIRES_IN=8h
   ```

2. Create the `mk_paper_mill` database and restore the SQL backup:
   ```bash
   # Create Database in PostgreSQL
   createdb -h localhost -p 5432 -U postgres mk_paper_mill

   # Restore the full dump (schema + all table data)
   psql -h localhost -p 5432 -U postgres -d mk_paper_mill -f database_backup/mk_paper_mill_full_dump.sql
   ```
   *(Or alternatively, execute `node backend/scripts/restore_database_bundle.js`)*

### Step 5: Start the Application
- **Windows**: Double-click `Start MK Paper Mill.vbs` or run `start.bat`.
- **Linux / Mac**: Run `npm run dev` in both `backend/` and `frontend/` folders, or use `pm2`.

---

## 4. End-to-End Core Workflows & Logic Flow

### Workflow A: Material Indent & Issuance (PIIMAS)
1. **Raising Indent**: User selects Department, Plant Section, Machine Context, Material / Spare, Required Quantity, and Technical Reason Code.
2. **Multi-tier Approval**: Configured approval matrix (L1 Supervisor ➔ L2 HOD ➔ Store Incharge).
3. **Store Manager Deletion / Purge**: Store Managers can cancel redundant or erroneous indents with structured reason logging or permanently delete test entries.
4. **Issuance & Fitment**: Store issues full or partial quantities, automatically deducting `materials.current_stock` and recording entries in `stock_ledger`.

### Workflow B: Complete Procure-to-Pay (P2P) Pipeline
1. **Purchase Order (PO)**: Store / Procurement raises PO with GST calculation (0%, 5%, 12%, 18%, 28%) and vendor credit terms.
2. **Inward & GRN Generation**: Consignment physically inspected at Store Inward Desk; accepted quantities atomically increment `materials.current_stock` and write to `stock_ledger`.
3. **Purchase Entry / Bill Booking**: Commercial Vendor Invoice booked with Vendor Invoice No, Date, and 3-Way Match validation against PO rates and GRN accepted quantities.
4. **Finance AP Clearance & Settlement**: Finance Officer reviews and approves bill for payment, recording disbursement via NEFT/Cheque/Cash with UTR reference, updating live Accounts Payable ledger.

### Workflow C: Production DPR, Lab Quality & WhatsApp EOD
1. **Reel Production**: Operators log reel weight, GSM, moisture, caliper, and speed.
2. **Quality & QC**: Pass/Fail lab test tracking with Burst Factor and Tear Index calculations.
3. **WhatsApp EOD Report**: 1-click comprehensive summary compiled from live PostgreSQL tables ready for dispatch to Executive Management.

---

## 5. Verification & Test Suite

Run the automated test suite at any time to verify system health:
```bash
cd backend
node scripts/test_complete_p2p_flow.js
node scripts/test_indent_cancel_and_append.js
node scripts/test_store_dashboard_analytics.js
```
*(All test suites will execute and verify 100% database synchronization).*

---

## 6. Default User Accounts (For Testing & Verification)

| Role | Username / Email | Default Password | Role Level |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` / `admin@mkpapermill.com` | `admin123` | Level 5 (Super Admin) |
| **Plant Head** | `planthead` | `admin123` | Level 4 (Executive) |
| **Store Manager** | `store` / `store@mkpapermill.com` | `admin123` | Level 3 (Store Incharge) |
| **Finance Officer** | `finance` | `admin123` | Level 3 (Accounts / AP) |
| **Mechanical Engineer** | `mech` | `admin123` | Level 2 (Department Staff) |
| **Electrical Engineer** | `elect` | `admin123` | Level 2 (Department Staff) |

---

## 7. Multi-Agent Daily 9:00 PM Automated Backup & Excel Reporting System

The ERP includes an autonomous 7-agent backup system that triggers every day at **9:00 PM (21:00:00 IST)** and saves complete archives to:
`C:\Users\MKKANTA\MK_Mill\Backup_Database\`

### System Agents Architecture:
1. **`PgDatabaseBackupAgent`**: Generates full self-contained PostgreSQL SQL dump (`mkmill_pg_backup_*.sql`) with schema, tables, sequences, constraints, triggers, and live data.
2. **`InventoryReportAgent`**: Generates `MK_Mill_Inventory_Master_Report_*.xlsx` (Executive KPI Dashboard, 1,354+ Master Catalog items, Reorder Shortfall Alerts, Class A High-Value Items, Category breakdown sheets).
3. **`ProcurementReportAgent`**: Generates `MK_Mill_Procurement_P2P_Report_*.xlsx` (P2P KPI Dashboard, PR Indents, POs with item pricing, GRNs with physical inspection status, Cash Purchases, Gate Passes).
4. **`StoreMovementReportAgent`**: Generates `MK_Mill_Store_Movements_Report_*.xlsx` (Movement Dashboard, 2,377+ Double-Entry Stock Ledger records, Department-wise consumption matrix, Transfers & Returns).
5. **`FinanceVendorReportAgent`**: Generates `MK_Mill_Finance_Vendors_Report_*.xlsx` (AP KPI Dashboard, Master Vendor Directory, AP Bills & Invoices, Payment Disbursements).
6. **`PlantQualityReportAgent`**: Generates `MK_Mill_Plant_Operations_Report_*.xlsx` (Plant Dashboard, Equipment Master, Electrical Motors & Bearing specs, Daily Production DPRs, Lab QC Tests).
7. **`IntegrityVerificationAgent`**: Generates cryptographic SHA-256 manifest (`_BACKUP_MANIFEST.json`), human-readable summary (`DAILY_BACKUP_SUMMARY.md`), records audit event in PostgreSQL (`audit_log`), updates `Latest_Backup/` mirror, and enforces 30-day rolling retention.

### Automation & Execution:
- **Windows Task Scheduler (Daily 9:00 PM)**: Configured via `setup_backup_scheduler.bat` (or `scripts/setup_daily_backup_task.ps1`).
- **In-App Server Daemon**: Automatically calculates delay to next 21:00:00 upon server startup and triggers daily backup.
- **1-Click Manual Execution**: Double-click `run_backup_now.bat` (or run `node scripts/run_multi_agent_backup.js`) to trigger backup immediately.

