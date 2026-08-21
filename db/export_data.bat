@echo off
title MK Paper Mill - Export Database
setlocal EnableDelayedExpansion

set "ROOT=%~dp0.."
set "BACKUPDIR=%ROOT%\db\backups"
if not exist "%BACKUPDIR%" mkdir "%BACKUPDIR%"

set TIMESTAMP=%DATE:~6,4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
set OUTFILE=%BACKUPDIR%\mk_paper_mill_%TIMESTAMP%.sql

echo  MK Paper Mill - Database Export
echo  Output: %OUTFILE%
echo.

where pg_dump >nul 2>&1
if %errorlevel% NEQ 0 (
    if exist "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" set "PATH=C:\Program Files\PostgreSQL\18\bin;%PATH%"
    if exist "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" set "PATH=C:\Program Files\PostgreSQL\17\bin;%PATH%"
    if exist "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" set "PATH=C:\Program Files\PostgreSQL\16\bin;%PATH%"
    if exist "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" set "PATH=C:\Program Files\PostgreSQL\15\bin;%PATH%"
    if exist "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe" set "PATH=C:\Program Files\PostgreSQL\14\bin;%PATH%"
)

echo  Enter PostgreSQL password when prompted:
pg_dump -U postgres -d mk_paper_mill --no-owner --no-acl -f "%OUTFILE%"

if %errorlevel%==0 (
    echo.
    echo  SUCCESS! Database exported to:
    echo  %OUTFILE%
    echo.
    echo  Copy this file to the new PC, then run:
    echo  psql -U postgres -d mk_paper_mill -f "%OUTFILE%"
    echo.
    echo  Or create the DB first:
    echo  createdb -U postgres mk_paper_mill
    echo  psql -U postgres -d mk_paper_mill -f "%OUTFILE%"
) else (
    echo  [ERROR] Export failed. Make sure pg_dump is installed and PostgreSQL service is running.
)
pause
