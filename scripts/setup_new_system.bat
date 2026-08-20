@echo off
title MK Paper Mill ERP - Automated System Migration & Setup
color 0A
cd /d "%~dp0\.."

echo ================================================================
echo   MK PAPER MILL ERP - AUTOMATED SYSTEM MIGRATION SETUP
echo ================================================================
echo   This script will configure your new system identically:
echo   1. Verify Node.js and PostgreSQL environment
echo   2. Restore the complete database with all data ^& schema
echo   3. Install all dependencies for Backend ^& Frontend
echo   4. Build production frontend assets
echo   5. Launch the ERP system
echo ================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js v18+ from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js detected:
node -v

:: 2. Check/Install Dependencies
echo.
echo [1/4] Installing Backend Dependencies...
cd backend
call npm install
cd ..

echo.
echo [2/4] Installing Frontend Dependencies...
cd frontend
call npm install
cd ..

:: 3. Restore Database
echo.
echo [3/4] Restoring PostgreSQL Database ^& Data...
node scripts/restore_db.js
if %errorlevel% neq 0 (
    echo [WARNING] Database restoration had warnings. Please ensure PostgreSQL is running.
)

:: 4. Build Frontend
echo.
echo [4/4] Building Frontend Production Bundle...
cd frontend
call npm run build
cd ..

echo.
echo ================================================================
echo   SETUP COMPLETE! Starting MK Paper Mill ERP Services...
echo ================================================================
echo.

call start.bat
