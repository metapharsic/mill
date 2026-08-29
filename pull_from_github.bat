@echo off
title MK Paper Mill - Pull from GitHub
cd /d "%~dp0"
echo ================================================================
echo 📥 MK PAPER MILL - PULLING FROM GITHUB (origin/main)...
echo ================================================================
echo.
echo This now runs a safer PowerShell pull that:
echo   - refuses to pull if you have uncommitted local changes
echo   - shows/logs the exact commits about to be pulled in
echo   - shows/logs the exact files changed after the pull
echo   - saves a full audit log under pull_logs\
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pull_from_github.ps1"
exit /b %errorlevel%
