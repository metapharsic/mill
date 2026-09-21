@echo off
TITLE MK Paper Mill - Daily 9:00 PM Backup Scheduler Setup
COLOR 0B

echo ==============================================================================
echo    SRI M.K. PAPER MILLS PVT. LTD. - AUTOMATED BACKUP SCHEDULER SETUP
echo ==============================================================================
echo.
echo Configuring automated daily 9:00 PM Multi-Agent Database and Excel backup...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup_daily_backup_task.ps1"

echo.
echo ==============================================================================
echo Setup process finished. Press any key to exit.
echo ==============================================================================
pause
