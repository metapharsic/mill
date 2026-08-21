@echo off
title MK Paper Mill ERP - Client 1-Click Update & Launch
color 0b
echo ========================================================
echo   MK Paper Mill ERP - Client Update & Sync Utility
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/6] Stopping any running ERP services...
call stop.bat >nul 2>&1

echo [2/6] Pulling latest code and features from GitHub (branch: main)...
git fetch origin
git checkout main
git reset --hard origin/main
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git pull failed. Please check internet connection or Git credentials.
    pause
    exit /b 1
)

echo [3/6] Restoring full live PostgreSQL database and master catalog...
call node backend/scripts/restore_database_bundle.js

echo [4/6] Installing backend dependencies...
cd backend
call npm install --no-audit --prefer-offline >nul 2>&1
cd ..

echo [5/6] Compiling latest Frontend React bundle (Excel Exporter, Modals, Tables)...
cd frontend
call npm install --no-audit --prefer-offline >nul 2>&1
call npm run build
cd ..

echo [6/6] Launching MK Paper Mill ERP...
color 0a
echo ========================================================
echo   SUCCESS! The system is 100% updated with:
echo   - Enterprise Inventory Master Excel Exporter
echo   - Full Multi-Sheet Category Breakdowns & Reorder Alerts
echo   - Live Database Records & Stock Ledger Synchronization
echo ========================================================
echo.
echo NOTE: If you still see cached screens in your browser,
echo press Ctrl + Shift + R (Hard Reload).
echo.
timeout /t 3 >nul 2>&1
call start.bat
