@echo off
title MK Paper Mill - Pull from GitHub
cd /d "%~dp0"
echo ================================================================
echo 📥 MK PAPER MILL - PULLING FROM GITHUB (origin/main)...
echo ================================================================
echo.
echo Checking for local changes not yet committed...
git status --short
echo.
echo Fetching latest from https://github.com/metapharsic/mill.git ...
git fetch origin
if %errorlevel% neq 0 (
    echo.
    echo ❌ Git fetch failed. If GitHub prompted for credentials, please enter your
    echo    GitHub Username and Personal Access Token (PAT), or sign in via browser.
    echo.
    pause
    exit /b 1
)
echo.
echo Merging origin/main into your current branch...
git pull origin main
if %errorlevel% neq 0 (
    echo.
    echo ================================================================
    echo ⚠️  PULL DID NOT COMPLETE CLEANLY
    echo ================================================================
    echo This usually means either:
    echo   1) You have uncommitted local changes that conflict with incoming
    echo      changes — commit or stash them first ^(git stash^), then re-run.
    echo   2) A merge conflict needs manual resolution — check the files
    echo      git just listed above, fix the conflict markers, then run:
    echo        git add ^<file^>
    echo        git commit
    echo.
) else (
    echo.
    echo ================================================================
    echo ✅ SUCCESS: REPO UPDATED FROM GITHUB
    echo ================================================================
    echo.
    echo NOTE: if frontend/backend files changed, remember to:
    echo   - rebuild the frontend:  cd frontend ^&^& npm run build
    echo   - restart the backend:   stop.bat then start_prod.bat / start.bat
    echo.
)
echo.
pause
