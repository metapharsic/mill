@echo off
title MK Paper Mill ERP - Push to GitHub
color 0b
echo ========================================================
echo   MK Paper Mill ERP - GitHub Push Utility
echo   Remote: https://github.com/metapharsic/mill.git
echo   Branch: main
echo ========================================================
echo.
cd /d "%~dp0"
echo [1/2] Verifying git repository status...
git status
echo.
echo [2/2] Pushing all software, logic, data, and database backups to GitHub...
echo (If prompted, please sign in with your GitHub account in the browser)
echo.
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    color 0a
    echo ========================================================
    echo   SUCCESS! All code and database backups are on GitHub.
    echo ========================================================
) else (
    color 0c
    echo ========================================================
    echo   Push failed or was cancelled. Check credentials.
    echo ========================================================
)
echo.
pause
