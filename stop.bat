@echo off
title MK Paper Mill ERP - Shutdown

echo.
echo  ================================
echo   MK PAPER MILL ERP - STOPPING
echo  ================================
echo.

:: Kill by window title
echo [1/3] Killing frontend (port 3333)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3333 "') do (
    taskkill /F /PID %%a >nul 2>&1
    echo        PID %%a killed.
)

echo [2/3] Killing backend (port 5000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 "') do (
    taskkill /F /PID %%a >nul 2>&1
    echo        PID %%a killed.
)

:: Kill named windows
echo [3/3] Closing server windows...
taskkill /F /FI "WINDOWTITLE eq MK-Backend" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MK-Frontend" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MK-ERP-Prod" >nul 2>&1

echo.
echo  ================================
echo   STOPPED. All ports cleared.
echo  ================================
echo.
timeout /t 2 /nobreak >nul
