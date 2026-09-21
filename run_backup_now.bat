@echo off
TITLE MK Paper Mill - Multi-Agent Backup Runner
COLOR 0A

echo ==============================================================================
echo    SRI M.K. PAPER MILLS PVT. LTD. - MULTI-AGENT BACKUP ENGINE
echo ==============================================================================
echo.
echo Running full PostgreSQL Database Backup and Application Excel Reports...
echo Target Directory: C:\Users\MKKANTA\MK_Mill\Backup_Database
echo.

node "%~dp0scripts\run_multi_agent_backup.js"

echo.
echo ==============================================================================
echo Backup execution finished. Press any key to exit.
echo ==============================================================================
pause
