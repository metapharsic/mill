@echo off
title Create Desktop Shortcut - MK Paper Mill
color 0A
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$shortcut = $ws.CreateShortcut((Join-Path $desktop 'Start MK Paper Mill.lnk')); " ^
  "$shortcut.TargetPath = '%ROOT%\Start MK Paper Mill.vbs'; " ^
  "$shortcut.WorkingDirectory = '%ROOT%'; " ^
  "$shortcut.Description = 'MK Paper Mill ERP System'; " ^
  "$shortcut.Save(); " ^
  "Write-Host ' Desktop shortcut successfully created: Start MK Paper Mill.lnk' -ForegroundColor Green"

echo.
echo Desktop shortcut created!
timeout /t 3 >nul 2>&1
exit /b 0
