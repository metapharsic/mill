# MK Paper Mill ERP — Installation Guide

## System Requirements
- **Windows 10/11** (64-bit)
- **Node.js 18+** — Download from https://nodejs.org (LTS version)
- **PostgreSQL 14, 15, 16, or 17** — Download from https://www.postgresql.org/download/windows/

## Step-by-Step Installation on a New PC

### Step 1: Install Prerequisites
1. Download and install **Node.js 18 LTS** from https://nodejs.org
   - During installation, check "Automatically install the necessary tools"
2. Download and install **PostgreSQL 17** from https://www.postgresql.org/download/windows/
   - Remember the password you set for the `postgres` user
   - Keep the default port **5432**
   - Keep pgAdmin if you want a GUI to manage the database

### Step 2: Copy the Application
1. Copy the entire `MK-Mill` folder to the new PC (e.g., `C:\MK-Mill`)
   - You can copy via USB drive, network share, or zip file
   - Make sure to include the `db\backups\` folder with the exported database file

### Step 3: Import the Database
1. Open **pgAdmin** (installed with PostgreSQL) or open a Command Prompt
2. Create the database:
   ```
   createdb -U postgres mk_paper_mill
   ```
3. Import the backup file (use the .sql file from `db\full_dump\`):
   ```
   psql -U postgres -d mk_paper_mill -f db\full_dump\mk_paper_mill_20260718.sql
   ```
   Enter the PostgreSQL password when prompted.

### Step 4: Run Setup
1. Open the `MK-Mill` folder
2. Double-click **`setup.bat`**
3. Enter your PostgreSQL password when asked
4. Wait for setup to complete (2-5 minutes for first-time build)

### Step 5: Start the Application
1. Double-click **`start_prod.bat`**
2. The browser will open automatically at http://localhost:5000
3. Login with:
   - **Email:** `head.store@mkpapermill.com`
   - **Password:** `Head@1234`

## Daily Use
- **Start:** Double-click `start_prod.bat`
- **Stop:** Double-click `stop.bat` or close the background CMD window

## Exporting Data for a New PC
Run `db\export_data.bat` on the source PC to create a database backup.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Node.js not found" | Install Node.js 18+ and restart CMD |
| "PostgreSQL not running" | Open Services (services.msc) and start the PostgreSQL service |
| "pg_dump not found" | Add `C:\Program Files\PostgreSQL\17\bin` to your system PATH |
| Page shows blank/error | Check `logs\server.log` for the error message |
| Login fails | Make sure you imported the database backup correctly |
| Port 5000 in use | Run stop.bat first, or restart the PC |

## Port Used
- **5000** — Application (Backend + Frontend served together)

## Default Login Accounts
| Email | Role | Password |
|-------|------|----------|
| `head.store@mkpapermill.com` | Store Manager | `Head@1234` |

> **Security Note:** Change the default password after first login using the profile settings.
