#Requires -Version 5.0
# ================================================================
# MK PAPER MILL - PULL FROM GITHUB (origin/main)
# ================================================================
# This script:
#   1. Refuses to pull if you have uncommitted local changes (this is
#      the #1 cause of pulls that "don't sync properly").
#   2. Shows and logs the exact incoming commits BEFORE pulling.
#   3. Attempts a fast-forward-only pull first, falls back to a
#      regular merge pull if needed, and tells you clearly which one
#      happened.
#   4. Shows and logs the exact files/lines changed AFTER pulling.
#   5. Saves a full timestamped audit log to pull_logs\pull_<ts>.log

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
    Write-Both "Pulling now would be exactly why past pulls looked like they"
    Write-Both "'did not sync properly': if GitHub also changed any of these"
    Write-Both "same files, git either refuses the pull outright, or merges"
    Write-Both "in a confusing way that is easy to miss in the terminal."
    Write-Both ""
    Write-Both "Before pulling, do ONE of the following:"
    Write-Both "  1) Commit your changes:"
    Write-Both "       git add ."
    Write-Both "       git commit -m ""your message"""
    Write-Both "  2) Discard your local changes (THIS DELETES THEM):"
    Write-Both "       git checkout -- <file>"
    Write-Both "  3) Temporarily shelve your changes, pull, then restore them:"
    Write-Both "       git stash"
    Write-Both "       (re-run this pull script)"
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
    Write-Both "If GitHub prompted for credentials, sign in via browser or enter"
    Write-Both "your GitHub username and Personal Access Token (PAT)."
    Write-Both ""
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
    Write-Both "  (none — already up to date with origin/main)"
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
# STEP 4: pull - try fast-forward-only first, fall back to a
#         regular merge pull if that's not possible
# ---------------------------------------------------------------
Write-Both "----------------------------------------------------------------"
Write-Both "Attempting fast-forward-only pull ..."
Write-Both "----------------------------------------------------------------"
$ffOutput = & git pull --ff-only origin main 2>&1
$ffOutput | ForEach-Object { Write-Both $_ }

if ($LASTEXITCODE -eq 0) {
    Write-Both ""
    Write-Both "Fast-forward pull succeeded (no merge commit needed)."
    $pullClean = $true
} else {
    Write-Both ""
    Write-Both "Fast-forward not possible (your branch has diverged from"
    Write-Both "origin/main). Falling back to a regular merge pull ..."
    Write-Both ""
    $pullOutput = & git pull origin main 2>&1
    $pullOutput | ForEach-Object { Write-Both $_ }
    if ($LASTEXITCODE -ne 0) {
        Write-Both ""
        Write-Both "================================================================"
        Write-Both "PULL DID NOT COMPLETE CLEANLY"
        Write-Both "================================================================"
        Write-Both "This usually means a merge conflict needs manual resolution:"
        Write-Both "  1) Look at the files git listed above with conflict markers"
        Write-Both "  2) Fix the conflicts in each file"
        Write-Both "  3) Run:"
        Write-Both "       git add <file>"
        Write-Both "       git commit"
        Write-Both ""
        Write-Both "Log saved to: $logFile"
        Read-Host "Press Enter to exit" | Out-Null
        exit 1
    }
    Write-Both ""
    Write-Both "Merge pull succeeded (a real merge commit was created, this was"
    Write-Both "NOT a simple fast-forward)."
    $pullClean = $true
}
Write-Both ""

# ---------------------------------------------------------------
# STEP 5: show/log what actually changed
# ---------------------------------------------------------------
$newHead = (& git rev-parse HEAD 2>&1).Trim()
Write-Both "----------------------------------------------------------------"
Write-Both "FILES ACTUALLY CHANGED BY THIS PULL ($oldHead -> $newHead):"
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
Write-Both "  - rebuild the frontend:  cd frontend && npm run build"
Write-Both "  - restart the backend:   stop.bat then start_prod.bat / start.bat"
Write-Both "----------------------------------------------------------------"
Write-Both ""

Write-Both "================================================================"
Write-Both "SUCCESS: REPO UPDATED FROM GITHUB"
Write-Both "PULLED $incomingCount commit(s), $filesChanged file(s) changed."
Write-Both "Full audit log saved to:"
Write-Both "  $logFile"
Write-Both "================================================================"
Write-Both ""

Read-Host "Press Enter to exit" | Out-Null
exit 0
