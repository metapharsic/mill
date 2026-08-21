@echo off
title MK Paper Mill ERP - Production
color 0A
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "LOGS=%ROOT%\logs"

if not exist "%LOGS%" mkdir "%LOGS%"

echo  [1/3] Checking PostgreSQL...
netstat -an | findstr ":5432 " >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  [ERROR] PostgreSQL not running. Start PostgreSQL and retry.
    pause & exit /b 1
)

echo  [2/3] Building frontend if dist missing...
if not exist "%ROOT%\frontend\dist\index.html" (
    echo         Compiling frontend React bundle...
    cd /d "%ROOT%\frontend"
    call npm run build
    cd /d "%ROOT%"
)

echo  [3/3] Starting MK Paper Mill ERP (Production)...
start "MK-ERP-Prod" /min cmd /c "cd /d "%BACKEND%" && set NODE_ENV=production && node src/server.js > "%LOGS%\server.log" 2>&1"

echo         Waiting 5 seconds for server to boot...
ping -n 6 127.0.0.1 >nul 2>&1

echo.
echo  ================================================================
echo   MK PAPER MILL ERP IS RUNNING
echo  ----------------------------------------------------------------
echo   URL      : http://localhost:5000
echo   Login    : head.store@mkpapermill.com
echo   Password : Head@1234
echo  ----------------------------------------------------------------
echo   Log file : %LOGS%\server.log
echo   To stop  : Run stop.bat or close the background window
echo  ================================================================
echo.

ping -n 4 127.0.0.1 >nul 2>&1
start "" "http://localhost:5000"

echo  Browser opened. Press any key to close this window.
pause
