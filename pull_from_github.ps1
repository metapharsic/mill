#Requires -Version 5.0
# ================================================================
# MK PAPER MILL - PULL FROM GITHUB (origin/main)
# ================================================================

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir     = Join-Path $PSScriptRoot "pull_logs"
$logFile    = Join-Path $logDir "pull_$timestamp.log"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

function Write-Both {
    param([string]$Text = "")
    $Text | Tee-Object -FilePath $logFile -Append | Out-Host
}

Write-Both "================================================================"
Write-Both "MK PAPER MILL - PULLING FROM GITHUB (origin/main)"
Write-Both "Run started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Both "================================================================"
Write-Both ""

# ---------------------------------------------------------------
# STEP 1: refuse to pull with uncommitted local changes
# ---------------------------------------------------------------
Write-Both "Checking for local changes not yet committed..."
$statusOutput = & git status --short 2>&1
$statusOutput | ForEach-Object { Write-Both $_ }
Write-Both ""

if ($statusOutput -and ($statusOutput | Where-Object { $_.Trim() -ne "" })) {
    Write-Both "================================================================"
    Write-Both "STOPPED: YOU HAVE UNCOMMITTED LOCAL CHANGES"
    Write-Both "================================================================"
    Write-Both ""
    Write-Both "The files below are modified on this machine but not committed:"
    Write-Both ""
    $statusOutput | ForEach-Object { Write-Both "  $_" }
    Write-Both ""
    Write-Both "Before pulling, do ONE of the following:"
    Write-Both "  1) Commit your changes:"
    Write-Both "       git add ."
    Write-Both "       git commit -m 'your message'"
    Write-Both "  2) Discard your local changes:"
    Write-Both "       git checkout -- <file>"
    Write-Both "  3) Temporarily shelve your changes:"
    Write-Both "       git stash"
    Write-Both "       .\pull_from_github.bat"
    Write-Both "       git stash pop"
    Write-Both ""
    Write-Both "No changes were fetched or pulled. Log saved to:"
    Write-Both "  $logFile"
    Write-Both ""
    Read-Host "Press Enter to exit" | Out-Null
    exit 1
}

Write-Both "No uncommitted local changes found. Safe to proceed."
Write-Both ""

# ---------------------------------------------------------------
# STEP 2: fetch
# ---------------------------------------------------------------
$oldHead = (& git rev-parse HEAD 2>&1).Trim()
Write-Both "Current HEAD before pull: $oldHead"
Write-Both ""
Write-Both "Fetching latest from origin ..."
$fetchOutput = & git fetch origin 2>&1
$fetchOutput | ForEach-Object { Write-Both $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Both ""
    Write-Both "================================================================"
    Write-Both "GIT FETCH FAILED"
    Write-Both "================================================================"
    Write-Both "Log saved to: $logFile"
    Read-Host "Press Enter to exit" | Out-Null
    exit 1
}
Write-Both ""

# ---------------------------------------------------------------
# STEP 3: show incoming commits BEFORE merging
# ---------------------------------------------------------------
Write-Both "----------------------------------------------------------------"
Write-Both "INCOMING COMMITS (about to be applied from origin/main):"
Write-Both "----------------------------------------------------------------"
$incoming = & git log --oneline HEAD..origin/main 2>&1
if ($incoming -and ($incoming | Where-Object { $_.Trim() -ne "" })) {
    $incoming | ForEach-Object { Write-Both "  $_" }
    $incomingCount = ($incoming | Where-Object { $_.Trim() -ne "" }).Count
} else {
    Write-Both "  (none - already up to date with origin/main)"
    $incomingCount = 0
}
Write-Both ""

if ($incomingCount -eq 0) {
    Write-Both "================================================================"
    Write-Both "NO NEW COMMITS - ALREADY UP TO DATE"
    Write-Both "================================================================"
    Write-Both ""
    Write-Both "Log saved to: $logFile"
    Read-Host "Press Enter to exit" | Out-Null
    exit 0
}

# ---------------------------------------------------------------
# STEP 4: pull - try fast-forward-only first
# ---------------------------------------------------------------
Write-Both "----------------------------------------------------------------"
Write-Both "Attempting fast-forward-only pull ..."
Write-Both "----------------------------------------------------------------"
$ffOutput = & git pull --ff-only origin main 2>&1
$ffOutput | ForEach-Object { Write-Both $_ }

if ($LASTEXITCODE -eq 0) {
    Write-Both ""
    Write-Both "Fast-forward pull succeeded."
} else {
    Write-Both ""
    Write-Both "Falling back to regular merge pull ..."
    $pullOutput = & git pull origin main 2>&1
    $pullOutput | ForEach-Object { Write-Both $_ }
    if ($LASTEXITCODE -ne 0) {
        Write-Both ""
        Write-Both "================================================================"
        Write-Both "PULL DID NOT COMPLETE CLEANLY"
        Write-Both "================================================================"
        Write-Both "Merge conflict needs resolution:"
        Write-Both "  1) Fix conflicts in affected files"
        Write-Both "  2) Run: git add ."
        Write-Both "  3) Run: git commit"
        Write-Both ""
        Write-Both "Log saved to: $logFile"
        Read-Host "Press Enter to exit" | Out-Null
        exit 1
    }
    Write-Both ""
    Write-Both "Merge pull succeeded."
}
Write-Both ""

# ---------------------------------------------------------------
# STEP 5: show/log what actually changed
# ---------------------------------------------------------------
$newHead = (& git rev-parse HEAD 2>&1).Trim()
Write-Both "----------------------------------------------------------------"
Write-Both "FILES ACTUALLY CHANGED BY THIS PULL:"
Write-Both "From $oldHead to $newHead"
Write-Both "----------------------------------------------------------------"
$diffStat = & git diff --stat "$oldHead..$newHead" 2>&1
$diffStat | ForEach-Object { Write-Both "  $_" }
Write-Both ""

$filesChanged = 0
$lastLine = $diffStat | Select-Object -Last 1
if ($lastLine -match '(\d+)\s+files? changed') {
    $filesChanged = [int]$Matches[1]
}

Write-Both "----------------------------------------------------------------"
Write-Both "NOTE: if frontend/backend files changed, remember to:"
Write-Both "  - rebuild frontend: cd frontend; npm run build"
Write-Both "  - restart backend:  stop.bat then start_prod.bat / start.bat"
Write-Both "----------------------------------------------------------------"
Write-Both ""

Write-Both "================================================================"
Write-Both "SUCCESS: REPO UPDATED FROM GITHUB"
Write-Both "PULLED $incomingCount commit(s), $filesChanged file(s) changed."
Write-Both "Full audit log saved to: $logFile"
Write-Both "================================================================"
Write-Both ""

Read-Host "Press Enter to exit" | Out-Null
exit 0
