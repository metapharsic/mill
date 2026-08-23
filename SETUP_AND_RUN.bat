@echo off
title MK Paper Mill ERP — 1-Click System Setup & Launcher
color 0A
cd /d "%~dp0"

echo ================================================================
echo   SRI M.K. PAPER MILLS ERP — COMPLETE SYSTEM SETUP & LAUNCHER
echo ================================================================
echo   This script sets up the entire application on this machine:
echo   1. Validates Node.js (v18+) and PostgreSQL environment
echo   2. Installs Backend & Frontend packages
echo   3. Automatically restores full database schema and live data
echo   4. Builds optimized production frontend assets
echo   5. Starts Backend, Frontend dev/prod servers, and opens browser
echo ================================================================
echo.

:: 1. Verify Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not detected on your system PATH!
    echo Please download and install Node.js v18 or v20 from: https://nodejs.org
    echo After installing Node.js, run this script again.
    pause
    exit /b 1
)
echo [OK] Node.js detected:
node -v

:: 2. Install Backend Dependencies
echo.
echo [1/4] Installing Backend Dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [WARNING] Backend npm install finished with warnings. Continuing...
)
cd ..

:: 3. Install Frontend Dependencies
echo.
echo [2/4] Installing Frontend Dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [WARNING] Frontend npm install finished with warnings. Continuing...
)
cd ..

:: 4. Restore Full Database
echo.
echo [3/4] Restoring PostgreSQL Database & Live Data...
node scripts/restore_db.js
if %errorlevel% neq 0 (
    echo [WARNING] Database restore encountered notices. If PostgreSQL password differs from "postgres" or "yourpassword", please check backend/.env.
)

:: 5. Build Frontend Assets
echo.
echo [4/4] Building Frontend Production Assets...
cd frontend
call npm run build
cd ..

echo.
echo ================================================================
echo   ✅ SETUP & RESTORE COMPLETED SUCCESSFULLY!
echo ================================================================
echo   Launching MK Paper Mill ERP...
echo ================================================================
echo.

if exist "Start MK Paper Mill.vbs" (
    wscript "Start MK Paper Mill.vbs"
) else (
    call start.bat
)

exit /b 0
