# MK Paper Mill ERP — Complete System Migration & Restore Guide

This guide describes how to move the **MK Paper Mill ERP** to a different computer with identical database data, configuration, backend logic, and frontend UI.

---

## 📦 What is Included in the Backup

1. **Complete Database Dump**:
   - Location: `db/backups/mkmill_complete_dump.sql`
   - Contains: Schema, all tables, sequences, foreign keys, triggers, constraints, and complete live production data (*1,095 active materials, 35 categories, 23 users, stock ledgers, indents, GRNs, POs, digital twin assets*).
2. **Backend API Service**:
   - Node.js Express backend with zero hardcoding, live valuation queries, and security guards.
3. **Frontend Web Application**:
   - React + Vite Single Page Application with executive dashboards, store management, and real-time visualizers.
4. **Automated Setup & Restore Scripts**:
   - `scripts/setup_new_system.bat` / `scripts/setup_new_system.ps1` (1-click automated setup)
   - `scripts/restore_db.js` (Automated database restore engine)
   - `scripts/backup_db.js` (Instant database snapshot generator)
   - `start.bat` / `Start MK Paper Mill.vbs` (Unified application launcher)

---

## 🚀 Step-by-Step Instructions to Move to a New Computer

### Step 1: Install Prerequisites on the New Computer
Ensure the new computer has:
1. **Node.js (v18 or higher)**: Download from [https://nodejs.org](https://nodejs.org)
2. **PostgreSQL (v14 or higher)**: Download from [https://www.postgresql.org/download/](https://www.postgresql.org/download/)
   - Default Port: `5432`
   - Default User: `postgres`
   - Set password to: `postgres` (or update `backend/.env` with your password)

---

### Step 2: Copy the Project Folder or Unzip Backup
Copy the entire `mkmill-software-main` folder (or unzip `mkmill_complete_backup.zip`) to your desired location (e.g. `C:\MK_Mill\mkmill-software-main\mkmill-software-main`).

---

### Step 3: Configure Database Password (if different)
Open `backend/.env` in Notepad and verify your PostgreSQL credentials:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mk_paper_mill
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=mk_paper_mill_secret_key_prod_2026
```

---

### Step 4: 1-Click Automated Setup
In Windows File Explorer, simply **double-click**:
👉 **`scripts\setup_new_system.bat`** (or open PowerShell and run `.\scripts\setup_new_system.ps1`)

This automated script will:
- ✅ Install all Backend and Frontend npm dependencies
- ✅ Connect to PostgreSQL and create the `mk_paper_mill` database
- ✅ Restore the full SQL data dump (`db/backups/mkmill_complete_dump.sql`)
- ✅ Build frontend production assets
- ✅ Launch backend (`http://localhost:5000`) and frontend (`http://localhost:3333`)
- ✅ Open the ERP in your default browser!

---

## 🔑 Default Login Credentials

| Role | Email | Password |
|---|---|---|
| **System Administrator** | `admin@mkpapermill.com` | `Admin@1234` |
| **Plant Head** | `planthead@mkpapermill.com` | `Head@1234` |
| **Store Manager** | `head.store@mkpapermill.com` | `Head@1234` |
| **Purchase Head** | `head.purchase@mkpapermill.com` | `Head@1234` |
| **Production Head** | `head.production@mkpapermill.com` | `Head@1234` |
| **Maintenance Head** | `head.maintenance@mkpapermill.com` | `Head@1234` |
| **Quality Head** | `head.quality@mkpapermill.com` | `Head@1234` |
| **Finance Head** | `head.finance@mkpapermill.com` | `Head@1234` |

---

## 🛠️ Manual Commands Reference

If you prefer to run steps manually via terminal:

```bash
# 1. Restore Database
node scripts/restore_db.js

# 2. Start Backend Server
cd backend
npm install
node src/server.js

# 3. Start Frontend
cd frontend
npm install
npm run dev -- --port 3333
```

---

## 💾 Creating Future Database Backups
To generate a new database backup snapshot at any time, run:
```bash
node scripts/backup_db.js
```
This will automatically save a timestamped backup into `db/backups/` and update `db/backups/mkmill_complete_dump.sql`.
