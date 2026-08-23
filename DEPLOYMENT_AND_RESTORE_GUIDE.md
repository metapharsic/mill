# SRI M.K. PAPER MILLS ERP — Complete Deployment & System Restore Guide

## 1. Package Overview
This backup archive contains the complete standalone production codebase, database schema, live plant operational data, multi-agent pipelines, 100% A3 commercial invoice engines, and 1-click startup automation for **Sri M.K. Paper Mills Private Limited**.

### Included Components in Archive:
1. **`backend/`**: Node.js / Express REST API server with JWT authentication, PostgreSQL connection pool, audit logs, and 7 multi-agent workflow engines.
2. **`frontend/`**: React 18 + Vite frontend with complete UI components, sequence enforcement modals, 100% A3 printing engine, and live telemetry dashboards.
3. **`frontend/dist/`**: Compiled production web bundle ready for instant serving.
4. **`db/` & `database_backup/`**:
   - `db/backups/mkmill_complete_dump.sql`: Complete PostgreSQL database dump (all 108 tables, schemas, sequences, and live data).
   - `database_backup/json_tables/`: 108 table-by-table JSON export snapshots with manifest.
5. **`scripts/`**: Automation tools for backup, restore, database verification, sequence testing, and migrations.
6. **Launchers**:
   - `SETUP_AND_RUN.bat`: 1-Click automated installation and launch script for new systems.
   - `Start MK Paper Mill.vbs`: Clean background service launcher with health checking and automatic browser launch.
   - `start.bat` / `stop.bat`: Manual service controls.

---

## 2. Target Machine Prerequisites

Before running the application on the destination machine, ensure the following are installed:
1. **Node.js**: Version 18.x, 20.x, or newer ([Download Node.js](https://nodejs.org/)).
2. **PostgreSQL**: Version 14, 15, 16, 17, or 18 ([Download PostgreSQL](https://www.postgresql.org/download/)).
   - Default Database Name: `mk_paper_mill`
   - Default Port: `5432`
   - Default Username: `postgres`

---

## 3. Fast 1-Click Setup (Recommended)

1. **Extract ZIP Archive**:
   - Extract `mkmill_complete_backup.zip` to your desired directory (e.g. `C:\MK_Mill\mkmill-software-main`).
2. **Configure Database Password (if different from default)**:
   - Open `backend/.env` and update `DB_PASSWORD` if your PostgreSQL password is not `postgres` or `yourpassword`.
3. **Run 1-Click Setup**:
   - Double-click **`SETUP_AND_RUN.bat`** in the project root folder.
   - The script will automatically:
     - Detect Node.js
     - Install all backend and frontend dependencies (`npm install`)
     - Create database `mk_paper_mill` and restore all tables, sequences, and data
     - Build optimized production frontend assets
     - Launch the application and open your browser automatically.

---

## 4. Manual Setup (Alternative Step-by-Step)

If you prefer to run commands manually:

### Step 1: Install Dependencies
```bash
# In project root
cd backend
npm install
cd ../frontend
npm install
cd ..
```

### Step 2: Restore Database
```bash
node scripts/restore_db.js
```
*Note: This script automatically checks if database `mk_paper_mill` exists, creates it if needed, and loads all 108 tables and records.*

### Step 3: Build Frontend (Optional for dev, required for prod)
```bash
cd frontend
npm run build
cd ..
```

### Step 4: Start Application
- **Double click**: `Start MK Paper Mill.vbs`  
*OR*
- Run via terminal:
```bash
# Terminal 1: Backend Server
cd backend
npm run dev

# Terminal 2: Frontend Server
cd frontend
npm run dev
```

---

## 5. System Access & Default Credentials

- **Frontend Application URL**: `http://localhost:5173` (or `http://localhost:5000` in production)
- **Backend API URL**: `http://localhost:5000/api/health`

### Key Roles & Testing Credentials:
| Role | Department | Description |
| :--- | :--- | :--- |
| **Store Manager** | Stores & Purchase | Full control over approvals, category allocations, master GRN, and A3 prints |
| **Store Keeper** | Stores | Physical stock issue, bin allocation, and SIV slip generation |
| **Indentor / Technical Staff** | Mechanical / Electrical / Production | Raise multi-department requisitions across 26 plant departments |
| **Department Receiver** | Mechanical / Maintenance | Digital sign-off, fitment tracking, and closure |

---

## 6. Multi-Agent Governance & Sequence Verification
To verify the system integrity on the new machine, run:
```bash
node scripts/test_sequence_guards.js
```
This tests:
- Out-of-sequence issuance blocking
- Premature receiver sign blocking
- Complete 4-step lifecycle validation
