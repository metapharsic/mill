# MK Paper Mill ERP — Client Deployment Guide
> **Who is this for?** This guide is for setting up the MK Paper Mill ERP on a client's PC from scratch.
> No coding knowledge needed. Follow each step exactly as written.

---

## 📋 Overview — What You Will Do

```
STEP 1  → Install Node.js on client PC
STEP 2  → Install PostgreSQL on client PC
STEP 3  → Add PostgreSQL to System PATH
STEP 4  → Copy project files from your PC to client PC
STEP 5  → Export database from your PC
STEP 6  → Import database on client PC
STEP 7  → Run setup (one click)
STEP 8  → Start the application
STEP 9  → Test login
```

Total time: **30–60 minutes** (depending on internet speed for downloads)

---

## 🖥️ PART 1 — DO THIS ON THE CLIENT'S PC

---

### STEP 1 — Install Node.js

Node.js is the engine that runs the backend server.

1. Open any browser (Chrome, Edge, Firefox)
2. Go to: **https://nodejs.org**
3. Click the big green **"LTS" button** (NOT "Current") — it will download a `.msi` file
4. Once downloaded, open the installer file
5. Follow the installation wizard:
   - Click **Next**
   - Accept the license agreement → **Next**
   - Keep default install location → **Next**
   - On the "Custom Setup" page → keep defaults → **Next**
   - ✅ On the "Tools for Native Modules" page → **CHECK the checkbox** that says "Automatically install the necessary tools" → **Next**
   - Click **Install**
   - Click **Finish**
6. A black window may pop up asking to install extra tools — press **Enter** or **Y** when asked and let it finish

**Verify Node.js is installed:**
1. Press `Win + R` on keyboard → type `cmd` → press Enter
2. In the black window, type exactly: `node --version` → press Enter
3. You should see something like: `v18.20.4` or higher
4. Also type: `npm --version` → press Enter
5. You should see something like: `10.7.0`

✅ If you see version numbers — **Node.js is installed correctly**
❌ If you see "not recognized" — restart the PC and try again

---

### STEP 2 — Install PostgreSQL

PostgreSQL is the database that stores all the ERP data.

1. Go to: **https://www.postgresql.org/download/windows/**
2. Click **"Download the installer"** (blue link)
3. On the next page, find **PostgreSQL 17** in the table
4. Click the **download icon** in the Windows row (64-bit)
5. Once downloaded, open the installer file (it says `postgresql-17-x-windows-x64.exe`)
6. Follow the installation wizard:
   - Click **Next**
   - Keep default install location → **Next**
   - On "Select Components" — make sure ALL boxes are checked:
     - ✅ PostgreSQL Server
     - ✅ pgAdmin 4
     - ✅ Stack Builder
     - ✅ Command Line Tools
   - Click **Next**
   - Keep default data directory → **Next**
   - **🔑 SET A PASSWORD** for the `postgres` user
     > ⚠️ **IMPORTANT: Write this password down. You will need it multiple times.**
     > Use a simple password like: `postgres` or `Admin1234`
   - Keep default port **5432** → **Next**
   - Keep default locale → **Next**
   - Click **Next**
   - Click **Finish**
7. If a "Stack Builder" window opens → click **Cancel** (not needed)

**Verify PostgreSQL is running:**
1. Press `Win + R` → type `services.msc` → press Enter
2. In the list, find a service starting with **"postgresql"** (e.g., `postgresql-x64-17`)
3. Its Status should say **"Running"**

✅ If Status is "Running" — **PostgreSQL is installed and running correctly**
❌ If Status is blank/stopped → right-click it → click **Start**

---

### STEP 3 — Add PostgreSQL to System PATH

This lets you run database commands from any folder in Command Prompt.

1. Press `Win + S` (or click the Search icon in taskbar)
2. Type: **environment variables** → click **"Edit the system environment variables"**
3. A window opens — click the **"Environment Variables..."** button at the bottom
4. In the bottom half ("System variables") — scroll down and find **"Path"**
5. Click on **"Path"** to highlight it → click **"Edit..."**
6. In the new window, click **"New"** (top right button)
7. Type exactly: `C:\Program Files\PostgreSQL\17\bin`
   > ⚠️ If you installed PostgreSQL 16 instead of 17, type: `C:\Program Files\PostgreSQL\16\bin`
8. Click **OK** → Click **OK** → Click **OK** (close all windows)
9. **Close all open Command Prompt windows** (if any were open, they need to be reopened)

**Verify PATH is set correctly:**
1. Press `Win + R` → type `cmd` → press Enter
2. Type: `psql --version` → press Enter
3. You should see: `psql (PostgreSQL) 17.x`

✅ If you see the version — **PATH is set correctly**
❌ If you see "not recognized" — double-check Step 3, make sure you clicked OK on all 3 windows

---

## 🗂️ PART 2 — DO THIS ON YOUR PC (the source PC)

---

### STEP 4 — Export the Database from Your PC

You need to create a fresh backup of the current database to transfer to the client.

1. Open the project folder: `C:\Users\Hamza\mkmills folder\mkmill-software\`
2. Open the `db` folder inside it
3. Double-click **`export_data.bat`**
4. A black window opens — it will ask for the PostgreSQL password
5. Type your PostgreSQL password (`hamza200426`) → press Enter
6. Wait a few seconds — you will see: **"SUCCESS! Database exported to:"** and a file path
7. The backup file is saved in: `mkmill-software\db\backups\` with a name like `mk_paper_mill_20260806_1430.sql`

> If export_data.bat fails, you can also do it manually:
> 1. Open Command Prompt
> 2. Type: `pg_dump -U postgres -d mk_paper_mill --no-owner --no-acl -f "C:\backup.sql"`
> 3. Enter your password when asked

---

### STEP 5 — Prepare the Project Files for Transfer

You need to give the client a copy of the project files. **Do NOT include `node_modules` folders** — they are huge and will be reinstalled on the client PC.

**Method A: USB Drive (Recommended if no internet)**

1. Get a USB drive with at least **2 GB** free space
2. Copy the entire `mkmill-software` folder to the USB drive
   > ⚠️ Before copying, delete these two folders to save space (they will be reinstalled):
   > - `mkmill-software\backend\node_modules` (delete this folder)
   > - `mkmill-software\frontend\node_modules` (delete this folder)
   > - `mkmill-software\frontend\dist` (delete this folder — will be rebuilt)
3. Also copy the database backup file from `mkmill-software\db\backups\` to the USB drive separately (keep it accessible)

**Method B: Zip File (via email or cloud)**

1. Right-click the `mkmill-software` folder → **"Send to"** → **"Compressed (zipped) folder"**
2. Wait for it to compress (may take 2–5 minutes)
3. Send the zip file to the client via Google Drive, WeTransfer, or a USB drive
4. Also include the `.sql` database backup file separately

---

## 🖥️ PART 3 — BACK ON THE CLIENT'S PC

---

### STEP 6 — Copy Project Files to Client PC

1. Plug in the USB drive (or download the zip file)
2. Copy the `mkmill-software` folder to: `C:\MK-Mill\`
   - Final path should be: `C:\MK-Mill\mkmill-software\`
   > ✅ **Tip:** Avoid paths with spaces or special characters. Use `C:\MK-Mill\` not your Desktop.
3. Also copy the `.sql` database backup file to: `C:\MK-Mill\` (anywhere accessible)

---

### STEP 7 — Create the Database on Client PC

1. Press `Win + R` → type `cmd` → press Enter (this opens Command Prompt)
2. Type the following command and press Enter:
   ```
   createdb -U postgres mk_paper_mill
   ```
3. It will ask: **Password:** → type the PostgreSQL password you set during install → press Enter
4. If successful — nothing will happen (no output = success ✅)
5. If you get an error saying "database already exists" — that is fine, continue to next step

---

### STEP 8 — Import the Database

Now you load all the data into the database.

1. In the same Command Prompt window, type this command (replace the path with where your `.sql` file actually is):
   ```
   psql -U postgres -d mk_paper_mill -f "C:\MK-Mill\mk_paper_mill_20260806_1430.sql"
   ```
   > ⚠️ Change the filename to match your actual backup file name (check what it's called)
2. It will ask: **Password:** → type the PostgreSQL password → press Enter
3. You will see many lines scrolling by — this is normal. Wait for it to finish.
4. When it stops and you see a `postgres=#` or the cursor returns — it is done ✅

> **If you are using the pre-existing dump file** (not a fresh export):
> The file is already in the project at: `mkmill-software\db\full_dump\mk_paper_mill_20260718.sql`
> Use that path instead:
> ```
> psql -U postgres -d mk_paper_mill -f "C:\MK-Mill\mkmill-software\db\full_dump\mk_paper_mill_20260718.sql"
> ```

---

### STEP 9 — Run the Setup Script

This script installs all dependencies and builds the frontend. Run it once.

1. Open the `C:\MK-Mill\mkmill-software\` folder in File Explorer
2. Find the file called **`setup.bat`**
3. Right-click it → click **"Run as administrator"**
   > ⚠️ You MUST right-click and choose "Run as administrator" — not just double-click
4. A blue/black window opens. It will go through 7 steps:
   - [1/7] Checking Node.js — should say OK
   - [2/7] Checking PostgreSQL — should say OK
   - [3/7] Setting up environment — it will ask: **"DB Password:"**
     → Type the client's PostgreSQL password → press Enter
   - [4/7] Installing backend — this downloads packages, takes 1–3 minutes
   - [5/7] Setting up database — runs migrations
   - [6/7] Building frontend — takes 1–3 minutes (shows "Building...")
   - [7/7] Setup complete!
5. At the end you will see: **"SETUP COMPLETE"**
6. Press any key to close the window

> ❌ **If step [4/7] fails with a network error:**
> The PC may not have internet access. In that case, you need to copy `node_modules` from the source PC:
> - On your PC: copy `mkmill-software\backend\node_modules` folder to USB
> - On client PC: paste it into `C:\MK-Mill\mkmill-software\backend\`
> - Do the same for `frontend\node_modules`
> - Then re-run setup.bat (it will skip the npm install steps)

---

### STEP 10 — Configure the Environment File

The setup script creates a `.env` file but you should verify it is correct.

1. Open File Explorer → go to `C:\MK-Mill\mkmill-software\backend\`
2. You should see a file called `.env` (no extension — just `.env`)
   > ⚠️ If you cannot see it: In File Explorer → click **View** tab → check **"Hidden items"**
3. Right-click `.env` → **Open with** → **Notepad**
4. The file should look like this:
   ```
   PORT=5000
   NODE_ENV=production
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=mk_paper_mill
   DB_USER=postgres
   DB_PASSWORD=ClientsPasswordHere
   JWT_SECRET=mk_paper_mill_jwt_secret_change_in_production_XXXXX
   JWT_EXPIRES_IN=8h
   KAFKA_ENABLED=false
   CORS_ORIGIN=
   ```
5. Make sure `DB_PASSWORD` matches the password the client set during PostgreSQL installation
6. If anything looks wrong, fix it and save the file (`Ctrl + S`)

---

### STEP 11 — Start the Application

1. Go to: `C:\MK-Mill\mkmill-software\`
2. Find the file called **`start_prod.bat`**
3. Double-click it (no need to run as administrator this time)
4. A window opens — it will:
   - Check PostgreSQL is running
   - Clear port 5000
   - Start the server
   - Wait 5 seconds
   - **Automatically open the browser** at http://localhost:5000
5. You will see the MK Paper Mill login page in the browser ✅

---

### STEP 12 — Login and Test

1. In the login page, enter:
   - **Email:** `head.store@mkpapermill.com`
   - **Password:** `Head@1234`
2. Click **Login**
3. You should see the Dashboard with charts and statistics ✅

> 🔐 **Important:** Tell the client to change the password immediately after first login.
> Go to their profile settings inside the app to change it.

---

## 📅 DAILY USE INSTRUCTIONS (For the Client)

Tell your client these simple instructions:

### To Start the Software Every Day:
1. Make sure the PC is on and logged into Windows
2. Open `C:\MK-Mill\mkmill-software\` in File Explorer
3. Double-click **`start_prod.bat`**
4. Browser will open automatically with the login page
5. Login with your email and password

### To Stop the Software:
1. Open `C:\MK-Mill\mkmill-software\` in File Explorer
2. Double-click **`stop.bat`**
3. All server processes will be stopped

### If the Browser Doesn't Open Automatically:
Open any browser and go to: **http://localhost:5000**

### Important: Do NOT Turn Off PostgreSQL
The PostgreSQL service must always be running. It starts automatically with Windows.
If it ever stops (rarely happens):
1. Press `Win + R` → type `services.msc` → press Enter
2. Find `postgresql-x64-17` → right-click → **Start**

---

## 🔧 TROUBLESHOOTING

| Problem You See | What To Do |
|----------------|-----------|
| "Node.js not found" when running setup.bat | Node.js not installed. Go back to Step 1 |
| "PostgreSQL not running on port 5432" | Open services.msc → find postgresql → Start it |
| "pg_dump not found" or "psql not recognized" | PATH not set. Go back to Step 3 |
| setup.bat stuck at [4/7] or [6/7] | No internet. Copy node_modules from USB (see note in Step 9) |
| Browser shows "This site can't be reached" | Server didn't start. Check `logs\server.log` file |
| Login fails with "Invalid credentials" | Database not imported properly. Redo Step 8 |
| Login fails with "Database connection error" | DB_PASSWORD in `.env` is wrong. Fix Step 10 |
| Port 5000 already in use | Run `stop.bat` first, then try again |
| "FATAL: JWT_SECRET" error | Edit `.env` → change `NODE_ENV` from `production` to `development` |
| Black window closes instantly | Right-click → "Run as administrator" |

---

## 📁 WHERE IMPORTANT FILES ARE

| What | Location |
|------|---------|
| Project folder | `C:\MK-Mill\mkmill-software\` |
| Start application | `C:\MK-Mill\mkmill-software\start_prod.bat` |
| Stop application | `C:\MK-Mill\mkmill-software\stop.bat` |
| First-time setup | `C:\MK-Mill\mkmill-software\setup.bat` |
| Environment config | `C:\MK-Mill\mkmill-software\backend\.env` |
| Server logs (if errors) | `C:\MK-Mill\mkmill-software\logs\server.log` |
| Database backup folder | `C:\MK-Mill\mkmill-software\db\backups\` |
| Export database backup | `C:\MK-Mill\mkmill-software\db\export_data.bat` |

---

## 💾 HOW TO TAKE DATABASE BACKUP (For Client)

Teach the client to take a backup once a week:

1. Open `C:\MK-Mill\mkmill-software\db\` in File Explorer
2. Double-click **`export_data.bat`**
3. Enter the PostgreSQL password when asked
4. A backup file is created in `db\backups\` folder
5. Copy that `.sql` file to a USB drive or Google Drive for safekeeping

---

## 🔁 HOW TO MOVE TO ANOTHER PC IN THE FUTURE

If you ever need to move the software to a new PC:

1. On the **old PC** → run `db\export_data.bat` to export fresh database backup
2. On the **new PC** → follow this entire guide from Step 1 to Step 12
3. In Step 8, use the fresh `.sql` backup file from Step 1 above (not the old one from July 2026)

---

## 📞 SUPPORT CHECKLIST

Before calling for support, check these:

- [ ] Is the PC on and logged in to Windows?
- [ ] Is PostgreSQL running? (check services.msc)
- [ ] Did you double-click `start_prod.bat`?
- [ ] Are you going to http://localhost:5000 in the browser?
- [ ] Is there an error in `logs\server.log`?

---

*Guide prepared for MK Paper Mill ERP — Version 1.0 — August 2026*
