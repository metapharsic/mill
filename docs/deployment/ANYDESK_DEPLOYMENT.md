# MK Paper Mill ERP — AnyDesk Remote Deployment Guide
> **Scenario:** You are on YOUR PC using AnyDesk to control the CLIENT's PC remotely.
> You will do everything yourself. Client just needs to sit and watch.

---

## 📋 BEFORE YOU START — CHECKLIST ON YOUR PC

Before connecting to the client's PC, prepare these things on your own PC first:

- [ ] Create the zip file of the project (instructions below)
- [ ] Export a fresh database backup
- [ ] Have AnyDesk installed on your PC
- [ ] Have the client install AnyDesk and share their ID with you

---

## 🗜️ STEP 1 — Create the ZIP File on YOUR PC

You need to send one clean zip to the client's PC via AnyDesk file transfer.

### Delete unnecessary folders first (to reduce zip size):
1. Open your project root folder (e.g. `mkmill-software\`)
2. Delete these folders (**only delete inside mkmill-software, NOT the whole project**):
   - `backend\node_modules` → right-click → Delete (this is ~200MB, not needed)
   - `frontend\node_modules` → right-click → Delete (this is ~150MB, not needed)
   - `frontend\dist` → right-click → Delete (will be rebuilt)

> ⚠️ Don't worry — these get reinstalled automatically by setup.bat / setup_new_system.bat

### Export a fresh database backup:
1. Open project root folder `scripts\`
2. Run `node scripts/backup_db.js`
3. Backup is saved into `db\backups\mkmill_complete_dump.sql`

### Create the ZIP:
1. Go to your project parent directory
2. Right-click the `mkmill-software` folder
3. Click **"Send to"** → **"Compressed (zipped) folder"** (or run `powershell ./scripts/create_zip_backup.ps1`)
4. Wait 2–5 minutes — it creates `mkmill_complete_backup.zip`
5. Move this zip to your Desktop (easy to find)

> 📦 The final zip should be around **600MB – 1.5GB** depending on the db backup size.

---

## 📡 STEP 2 — Connect to Client PC via AnyDesk

1. Ask the client to:
   - Download AnyDesk from: **https://anydesk.com/en/downloads/windows**
   - Open AnyDesk
   - Read you the **9-digit AnyDesk ID** shown on their screen (e.g., `123 456 789`)

2. On YOUR PC:
   - Open AnyDesk
   - Type the client's ID in the search bar
   - Click **Connect**

3. Client needs to click **"Accept"** on their screen

4. ✅ You now see and control the client's PC screen

---

## 💻 STEP 3 — Install Node.js on CLIENT's PC (via AnyDesk)

You are now controlling their screen. Do all of this yourself:

1. On their screen, open **Edge or Chrome** browser
2. Go to: **https://nodejs.org**
3. Click the big **"LTS"** download button
4. Wait for the `.msi` file to download (watch the bottom bar)
5. Once downloaded, click on it to open the installer
6. In the installer:
   - Click **Next**
   - Check **"I accept the terms"** → **Next**
   - Keep defaults → **Next** → **Next**
   - ✅ Check **"Automatically install the necessary tools"** → **Next**
   - Click **Install**
   - Click **Yes** on the UAC prompt (if it appears)
   - Click **Finish**
7. A blue/black PowerShell window may open to install extra tools
   - Press **Enter** when it asks
   - Wait for it to finish (may take 2–3 minutes)
   - Press **Enter** again at the end if it asks

**Verify on their PC:**
- Press `Win + R` → type `cmd` → Enter
- Type `node --version` → Enter
- Should show: `v18.x.x` ✅

---

## 🐘 STEP 4 — Install PostgreSQL on CLIENT's PC (via AnyDesk)

Still controlling their screen:

1. Open their browser → go to: **https://www.postgresql.org/download/windows/**
2. Click **"Download the installer"**
3. On the page, click the download icon next to **PostgreSQL 17** (Windows row, 64-bit)
4. Wait for the download (it is around 300MB)
5. Open the downloaded file (e.g., `postgresql-17-x-windows-x64.exe`)
6. In the installer:
   - **Next**
   - Keep default directory → **Next**
   - Select Components → keep ALL checked → **Next**
   - Keep data directory → **Next**
   - **Password:** Type a simple password you will remember — for example: `postgres`
     > 🔑 Write this down! You will use it in the .env file later.
   - Port: keep **5432** → **Next**
   - Locale: keep default → **Next**
   - **Next** → **Finish**
7. If Stack Builder opens → click **Cancel**

**Verify on their PC:**
- Press `Win + R` → type `services.msc` → Enter
- Find `postgresql-x64-17` in the list
- Status should be **Running** ✅

---

## 🛣️ STEP 5 — Add PostgreSQL to System PATH (via AnyDesk)

Still on their screen:

1. Click the Windows **Start** button
2. Type: `environment variables` → click **"Edit the system environment variables"**
3. Click **"Environment Variables..."** button (bottom of the window)
4. In **"System variables"** (bottom section) → click **"Path"** → click **"Edit..."**
5. Click **"New"** button
6. Type: `C:\Program Files\PostgreSQL\17\bin`
7. Click **OK** → **OK** → **OK**

**Verify:**
- Open a NEW Command Prompt (close old one first)
- Type `psql --version` → Enter
- Should show: `psql (PostgreSQL) 17.x` ✅

---

## 📤 STEP 6 — Transfer the ZIP File to Client's PC via AnyDesk

AnyDesk has a built-in file transfer feature:

### Method A — AnyDesk File Transfer (Easiest)
1. In your AnyDesk session toolbar (top of screen), look for the **File Transfer** icon
   (it looks like a folder with arrows, or go to **Session → File Manager**)
2. On the left panel: navigate to your Desktop → find `mkmill-software.zip`
3. On the right panel (client's PC): navigate to `C:\` → create a new folder called `MK-Mill`
4. Drag `mkmill-software.zip` from left panel to right panel
5. Wait for transfer to complete (may take 5–20 minutes depending on speed)

### Method B — Google Drive (If AnyDesk transfer is slow)
1. On YOUR PC: upload `mkmill-software.zip` to Google Drive
2. On the CLIENT's PC (via AnyDesk): open browser → open Google Drive → download the zip
3. This is often faster than AnyDesk direct transfer

### Method C — WeTransfer (No account needed)
1. On YOUR PC: go to **https://wetransfer.com**
2. Upload `mkmill-software.zip`
3. Get the download link
4. On CLIENT's PC (via AnyDesk): paste the link in browser → download

---

## 📁 STEP 7 — Extract the ZIP on Client's PC (via AnyDesk)

1. On their PC, open File Explorer → go to where the zip was downloaded (e.g., `C:\MK-Mill\`)
2. Right-click `mkmill-software.zip`
3. Click **"Extract All..."**
4. In the dialog box, set the destination to: `C:\MK-Mill\`
5. Click **"Extract"**
6. Wait for extraction (1–3 minutes)
7. You should now have: `C:\MK-Mill\mkmill-software\` folder ✅

---

## 🗄️ STEP 8 — Create and Import the Database (via AnyDesk)

On the client's PC, open Command Prompt:
- Press `Win + R` → type `cmd` → Enter

**Create the database:**
```
createdb -U postgres mk_paper_mill
```
When asked for password → type the PostgreSQL password you set in Step 4 → Enter

**Import the database:**

The database backup file is already inside the project at:
`db\backups\mkmill_complete_dump.sql`

Type this command:
```
node scripts/restore_db.js
```
or via psql:
```
psql -U postgres -d mk_paper_mill -f "db\backups\mkmill_complete_dump.sql"
```
→ Enter the password → Enter

You will see the verification output showing active materials, categories, and users. ✅

---

## ⚙️ STEP 9 — Run setup.bat (via AnyDesk)

1. On their PC, open File Explorer → go to `C:\MK-Mill\mkmill-software\`
2. Find **`setup.bat`**
3. Right-click → **"Run as administrator"**
4. Click **Yes** on the UAC prompt
5. When it asks **"DB Password:"** → type the PostgreSQL password you set in Step 4 → Enter
6. Wait for all steps to complete:
   - [1/7] Node.js ✅
   - [2/7] PostgreSQL ✅
   - [3/7] .env created ✅
   - [4/7] Installing backend dependencies (takes 1–3 min) ✅
   - [5/7] Database setup ✅
   - [6/7] Building frontend (takes 1–3 min) ✅
   - [7/7] Setup complete! ✅
7. Press any key to close

---

## 🚀 STEP 10 — Start the Application (via AnyDesk)

1. Go to: `C:\MK-Mill\mkmill-software\`
2. Double-click **`start_prod.bat`**
3. The browser opens automatically at **http://localhost:5000**
4. Login with: `head.store@mkpapermill.com` / `Head@1234`
5. You should see the Dashboard ✅

---

## ✅ STEP 11 — Final Checks Before Disconnecting

Go through this checklist while still on AnyDesk:

- [ ] Application opens at http://localhost:5000
- [ ] Login works with the given credentials
- [ ] Dashboard loads with data (charts, numbers visible)
- [ ] Test one more module (e.g., click "Store" or "Production")
- [ ] Create a **Desktop shortcut** for the client:
  - Right-click `start_prod.bat` → **"Send to"** → **"Desktop (create shortcut)"**
  - Rename it on Desktop to: **"Start MK Paper Mill"**
- [ ] Create a **Desktop shortcut** for stop:
  - Right-click `stop.bat` → **"Send to"** → **"Desktop (create shortcut)"**
  - Rename it to: **"Stop MK Paper Mill"**

---

## ⚠️ COMMON PROBLEMS DURING ANYDESK INSTALL

| Problem | Fix |
|---------|-----|
| AnyDesk file transfer very slow | Use Google Drive or WeTransfer instead (Method B/C) |
| UAC prompt not appearing (can't run as admin) | Ask client to right-click AnyDesk on their end and "Run as Administrator" |
| Node.js installer black window stays forever | It's installing extra tools — leave it for up to 10 minutes |
| `createdb` says "already exists" | No problem — just continue to the `psql` import step |
| setup.bat fails at [6/7] build step | Check internet — try: `cd C:\MK-Mill\mkmill-software\frontend` then `npm install` then `npm run build` in CMD |
| Browser doesn't open automatically | Manually open Edge/Chrome and go to http://localhost:5000 |
| Login page appears but login fails | Database import failed — redo Step 8 |
| AnyDesk screen is laggy | Lower quality: in AnyDesk → Settings → Display → reduce quality |
| Can't type passwords (AnyDesk blocking) | Click inside the CMD window first, then type |

---

## 🔒 AFTER DEPLOYMENT — TELL THE CLIENT

Before you disconnect from AnyDesk:

1. **Show them where the shortcut is** on the Desktop: "Start MK Paper Mill"
2. **Tell them their login**: `head.store@mkpapermill.com` / `Head@1234`
3. **Tell them to change the password** immediately after login
4. **Show them how to stop the server**: double-click "Stop MK Paper Mill" shortcut
5. **Tell them**: if the software ever doesn't work → first check if PostgreSQL is running (services.msc)

---

## 📌 QUICK REFERENCE CARD (Print This for Client)

```
╔══════════════════════════════════════════════════════╗
║         MK PAPER MILL ERP — QUICK REFERENCE          ║
╠══════════════════════════════════════════════════════╣
║  Start:    Double-click "Start MK Paper Mill"        ║
║            on Desktop                                ║
║                                                      ║
║  Website:  http://localhost:5000                     ║
║                                                      ║
║  Login:    head.store@mkpapermill.com                ║
║  Password: Head@1234  (CHANGE THIS!)                 ║
║                                                      ║
║  Stop:     Double-click "Stop MK Paper Mill"         ║
║            on Desktop                                ║
║                                                      ║
║  Problem?  Check PostgreSQL is Running               ║
║            (services.msc → postgresql → Start)      ║
╚══════════════════════════════════════════════════════╝
```

---

*AnyDesk Deployment Guide — MK Paper Mill ERP — August 2026*
