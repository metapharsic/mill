@echo off
title MK Paper Mill - Push to GitHub
cd /d "%~dp0"
echo ================================================================
echo 🚀 MK PAPER MILL - PUSHING TO GITHUB (origin/main)...
echo ================================================================
echo.
git status
echo.
echo Pushing commits to https://github.com/metapharsic/mill.git ...
git push origin main
if %errorlevel% neq 0 (
    echo.
    echo ❌ Git push failed. If GitHub prompted for credentials, please enter your
    echo    GitHub Username and Personal Access Token (PAT), or sign in via browser.
    echo.
) else (
    echo.
    echo ================================================================
    echo ✅ SUCCESS: ALL COMMITS AND DATA PUSHED TO GITHUB!
    echo ================================================================
)
echo.
pause
