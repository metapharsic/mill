' ============================================================
'  MK Paper Mill ERP — Smart Launcher
'  - If already running: opens browser immediately
'  - If not running: launches start.bat and opens browser
' ============================================================

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

root        = fso.GetParentFolderName(WScript.ScriptFullName)
startScript = root & "\start.bat"

' Check if frontend is already serving on port 3333
appRunning = False
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
If Err.Number <> 0 Then
    Set http = CreateObject("MSXML2.XMLHTTP")
End If
Err.Clear

http.Open "GET", "http://localhost:3333", False
http.setTimeouts 1000, 1000, 1000, 1000
http.Send

If Err.Number = 0 Then
    If http.Status >= 100 And http.Status < 500 Then
        appRunning = True
    End If
End If
Set http = Nothing
On Error GoTo 0

If appRunning Then
    shell.Run "http://localhost:3333", 1, False
Else
    shell.Run """" & startScript & """", 1, False
End If
