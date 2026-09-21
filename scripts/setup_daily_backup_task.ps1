# ==============================================================================
# MK PAPER MILL ERP - WINDOWS TASK SCHEDULER SETUP FOR DAILY 9:00 PM BACKUP
# ==============================================================================

$ErrorActionPreference = "Continue"

$taskName = "MK_Paper_Mill_Daily_Backup"
$projectRoot = "C:\Users\MKKANTA\MK_Mill"
$scriptPath = "$projectRoot\scripts\run_multi_agent_backup.js"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "CONFIGURING DAILY 9:00 PM MULTI-AGENT BACKUP IN WINDOWS TASK SCHEDULER" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

# 1. Locate Node.js executable
$nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    if (Test-Path "C:\Program Files\nodejs\node.exe") {
        $nodePath = "C:\Program Files\nodejs\node.exe"
    } elseif (Test-Path "C:\Program Files (x86)\nodejs\node.exe") {
        $nodePath = "C:\Program Files (x86)\nodejs\node.exe"
    } else {
        Write-Host "[ERROR] Node.js executable not found in PATH or standard installation directories." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Node.js Executable: $nodePath" -ForegroundColor Green
Write-Host "Target Script:     $scriptPath" -ForegroundColor Green
Write-Host "Working Directory: $projectRoot" -ForegroundColor Green

# 2. Unregister existing task if present
try {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Unregistering previous version of task '$taskName'..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    }
} catch {
}

# 3. Create Action, Trigger, and Settings using PowerShell cmdlets or schtasks
$action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$scriptPath`"" -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At 9:00PM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
$description = "Sri M.K. Paper Mills Pvt. Ltd. - Autonomous Daily 9:00 PM Multi-Agent Database and Application Excel Reports Backup Engine."

# 4. Register Scheduled Task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description $description -ErrorAction Stop | Out-Null
    Write-Host "`n[SUCCESS] TASK SUCCESSFULLY REGISTERED IN WINDOWS TASK SCHEDULER!" -ForegroundColor Green
} catch {
    Write-Host "Registering via schtasks.exe fallback..." -ForegroundColor Yellow
    $schCmd = "schtasks /Create /TN `"$taskName`" /TR `"`"$nodePath`" `"$scriptPath`"`" /SC DAILY /ST 21:00 /F"
    cmd /c $schCmd
}

# 5. Display Status
Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "TASK SCHEDULER DETAILS" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

$registeredTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($registeredTask) {
    $info = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue
    Write-Host "Task Name:        $($registeredTask.TaskName)" -ForegroundColor White
    Write-Host "State:            $($registeredTask.State)" -ForegroundColor Green
    Write-Host "Trigger Time:     Daily at 9:00 PM (21:00:00 IST)" -ForegroundColor Yellow
    Write-Host "Next Run Time:    $($info.NextRunTime)" -ForegroundColor Cyan
    Write-Host "Last Run Time:    $($info.LastRunTime)" -ForegroundColor Gray
    Write-Host "Last Result:      $($info.LastTaskResult)" -ForegroundColor Gray
}

Write-Host "==============================================================================`n" -ForegroundColor Cyan
