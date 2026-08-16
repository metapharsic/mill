# MK Paper Mill ERP — System Setup & Deployment Guide

This guide provides step-by-step instructions for deploying and configuring the **MK Paper Mill ERP** system on a new Windows or Linux environment.

---

## 1. System Requirements & Prerequisites

Ensure the target machine has the following software installed:

* **Operating System**: Windows 10/11 / Windows Server 2019+ or Linux (Ubuntu 20.04+ LTS).
* **Node.js**: v18.0.0 or higher (Recommended: v18 LTS / v20 LTS).
* **PostgreSQL**: v14.0 or higher.
* **Git**: Required for repository cloning and update management.
* **PM2** (Optional, for Linux production daemon): `npm install -g pm2`.

---

## 2. Environment Setup & Repository Installation

### Step 2.1: Clone Repository
```bash
git clone https://github.com/sameerpashaaa/mkmill-software.git
cd mkmill-software
```

### Step 2.2: Install Node.js Dependencies
Install dependencies for both the backend and frontend modules:

```bash
# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

---

## 3. PostgreSQL Database Setup & Data Restoration

### Step 3.1: Create Database
Open PostgreSQL terminal or pgAdmin and create the target database:

```sql
CREATE DATABASE mk_paper_mill;
```

### Step 3.2: Restore Latest Database Backup
Restore the database structure and initial seed data from the latest SQL backup file (`db/backups/mk_paper_mill_20260812_1156.sql`):

**On Windows (Command Prompt / PowerShell)**:
```cmd
psql -U postgres -d mk_paper_mill -f db\backups\mk_paper_mill_20260812_1156.sql
```

**On Linux / macOS**:
```bash
psql -U postgres -d mk_paper_mill -f db/backups/mk_paper_mill_20260812_1156.sql
```

*Note: Replace `postgres` with your database username if different.*

### Step 3.3: Apply Post-Backup Fixes

The backup snapshot was taken before a schema fix — run this once after restore so the indent approval workflow (`indents.status`) accepts `Approved`/`Issued`/`Closed`, not just the tiered `L1/L2/L3 Approved` labels:

```cmd
psql -U postgres -d mk_paper_mill -f db\migration_indent_status_widen.sql
```

---

## 4. Backend Environment Configuration (`backend/.env`)

Create or update `backend/.env` with your system's database credentials and secret key:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mk_paper_mill
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=mk_paper_mill_jwt_secret_production_key_change_me
```

---

## 5. Build & System Health Verification

### Step 5.1: Build Frontend Static Bundle
Compile the production-ready React frontend bundle:

```bash
npm --prefix frontend run build
```

### Step 5.2: Run Health & Preflight Checks
Verify database connectivity, schema alignment, and pre-deploy health:

```bash
# Run database synchronization check
npm --prefix backend run synccheck

# Run system preflight verification
npm --prefix backend run preflight
```

> **Expected Output**:
> - `synccheck`: `VERDICT: ✅ IN SYNC`
> - `preflight`: `PREFLIGHT PASSED. Safe to deploy.`

---

## 6. Running the Application

### Option A: Using Windows Automated Launch Scripts (Recommended for Windows)

Double-click or run:
```cmd
start.bat
```
*(This automatically launches the backend API on port 5000 and frontend server).*

To stop the system:
```cmd
stop.bat
```

---

### Option B: Development Mode (Hot Reloading)

Run the dev servers for frontend and backend in separate terminals:

```bash
# Terminal 1: Backend Server
cd backend
npm run dev

# Terminal 2: Frontend Server
cd frontend
npm run dev
```
Access the application at `http://localhost:3333`.

---

### Option C: PM2 Production Process Manager (Recommended for Production / Servers)

```bash
# Start backend and frontend via PM2
pm2 start ecosystem.config.js

# Save process list to auto-start on server reboot
pm2 save
pm2 startup
```

---

## 7. Operational & Maintenance Commands

| Task | Command |
| --- | --- |
| **Check Stack Status** | `node scripts/stack-status.js` |
| **Check Schema Sync** | `npm --prefix backend run synccheck` |
| **Run System Preflight** | `npm --prefix backend run preflight` |
| **Export DB Backup** | `db\export_data.bat` |
| **Stop PM2 Services** | `pm2 stop ecosystem.config.js` |

---

## 8. Default System Access

- **Frontend Interface**: `http://localhost:3333` (Dev) or `http://localhost:5000` (Production PM2 / Static).
- **Backend API**: `http://localhost:5000/api`
- **Health / Metrics**: `http://localhost:5000/metrics`
