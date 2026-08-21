' ============================================================
'  MK Paper Mill ERP — Unified Smart Launcher
'  - Always refreshes services to load latest code & enhancements
'  - Launches start.bat and opens browser cleanly
' ============================================================

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

root        = fso.GetParentFolderName(WScript.ScriptFullName)
startScript = root & "\start.bat"

' Run start.bat silently in background to restart services and launch browser
shell.Run """" & startScript & """", 1, False
