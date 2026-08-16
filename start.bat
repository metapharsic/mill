@echo off
title MK Paper Mill ERP - Startup
color 0A
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\run-app.ps1" -Root "%ROOT%"
timeout /t 3 >nul 2>&1
exit /b 0
