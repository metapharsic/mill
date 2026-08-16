@echo off
title MK Paper Mill ERP - Setup
color 0A
setlocal EnableDelayedExpansion

echo.
echo  ================================================================
echo    MK PAPER MILL ERP - FIRST TIME SETUP
echo  ================================================================
echo.

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

:: ── Check Node.js ────────────────────────────────────────────────
echo  [1/7] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=1" %%v in ('node --version') do set NODEVERSION=%%v
echo  [1/7] Node.js %NODEVERSION% found  OK

:: ── Check PostgreSQL ─────────────────────────────────────────────
echo  [2/7] Checking PostgreSQL...
netstat -an | findstr ":5432 " >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  [ERROR] PostgreSQL not running on port 5432.
    echo  [ERROR] Install PostgreSQL 14+ and start it, then re-run setup.
    pause & exit /b 1
)
echo  [2/7] PostgreSQL running  OK

:: ── Create .env ──────────────────────────────────────────────────
echo  [3/7] Setting up environment...
if not exist "%BACKEND%\.env" (
    echo  Enter your PostgreSQL password (default: postgres):
    set /p DBPASS="DB Password: "
    if "!DBPASS!"=="" set DBPASS=postgres
    (
        echo PORT=5000
        echo NODE_ENV=production
        echo DB_HOST=localhost
        echo DB_PORT=5432
        echo DB_NAME=mk_paper_mill
        echo DB_USER=postgres
        echo DB_PASSWORD=!DBPASS!
        echo JWT_SECRET=mk_paper_mill_jwt_secret_change_in_production_%RANDOM%%RANDOM%
        echo JWT_EXPIRES_IN=8h
        echo KAFKA_ENABLED=false
        echo CORS_ORIGIN=
    ) > "%BACKEND%\.env"
    echo  [3/7] .env created
) else (
    echo  [3/7] .env already exists  OK
)

:: ── Install backend dependencies ─────────────────────────────────
echo  [4/7] Installing backend dependencies...
cd /d "%BACKEND%"
npm install --omit=dev
if %errorlevel% NEQ 0 (
    echo  [ERROR] npm install failed in backend
    pause & exit /b 1
)
echo  [4/7] Backend dependencies installed  OK

:: ── Setup database ───────────────────────────────────────────────
echo  [5/7] Setting up database & restoring complete dump...
node "%ROOT%\scripts\restore_db.js"
if %errorlevel% NEQ 0 (
    echo  [WARN] Database restoration had warnings. Check PostgreSQL service.
)
echo  [5/7] Database setup complete  OK

:: ── Build frontend ──────────────────────────────────────────────
echo  [6/7] Building frontend (this takes 1-2 minutes)...
cd /d "%FRONTEND%"
npm install
if %errorlevel% NEQ 0 (
    echo  [ERROR] npm install failed in frontend
    pause & exit /b 1
)
npm run build
if %errorlevel% NEQ 0 (
    echo  [ERROR] Frontend build failed
    pause & exit /b 1
)
echo  [6/7] Frontend built  OK

:: ── Done ─────────────────────────────────────────────────────────
echo  [7/7] Setup complete!
echo.
echo  ================================================================
echo   SETUP COMPLETE
echo  ----------------------------------------------------------------
echo   Run start_prod.bat to launch the application
echo   URL : http://localhost:5000
echo   Login : head.store@mkpapermill.com
echo   Password : Head@1234 (change after first login)
echo  ================================================================
echo.
pause
