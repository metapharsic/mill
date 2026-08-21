# MK Paper Mill ERP — Fast Background Launcher
param(
  [string]$Root = $PSScriptRoot
)

if (-not $Root -or (Test-Path (Join-Path $Root "backend")) -eq $false) {
  $Root = (Get-Item $PSScriptRoot).Parent.FullName
}

$backend = Join-Path $Root "backend"
$frontend = Join-Path $Root "frontend"
$logs = Join-Path $Root "logs"

if (-not (Test-Path $logs)) {
  New-Item -ItemType Directory -Path $logs | Out-Null
}

Write-Host " [1/4] Starting PostgreSQL if stopped..." -ForegroundColor Cyan
try {
  $pgServices = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne 'Running' }
  foreach ($svc in $pgServices) {
    Start-Service $svc.Name -ErrorAction SilentlyContinue
  }
} catch {}

Write-Host " [2/4] Clearing existing ports (5000, 3333)..." -ForegroundColor Cyan
foreach ($port in @(5000, 3333)) {
  try {
    $lines = netstat -ano | Select-String (":{0}\s+.*LISTENING" -f $port)
    foreach ($line in $lines) {
      $pidNum = ($line.ToString().Trim() -split '\s+')[-1]
      if ($pidNum -match '^\d+$' -and [int]$pidNum -gt 0) {
        Stop-Process -Id [int]$pidNum -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
}

Start-Sleep -Milliseconds 500

Write-Host " [3/4] Starting Backend (port 5000)..." -ForegroundColor Cyan
$backCmd = "cd /d `"$backend`" && node src/server.js > `"$logs\backend.log`" 2>&1"
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $backCmd) -WindowStyle Hidden

# Wait for backend
$backendReady = $false
for ($i = 0; $i -lt 25; $i++) {
  try {
    $r = Invoke-WebRequest -Uri 'http://localhost:5000/api/health' -TimeoutSec 1 -UseBasicParsing
    if ($r.StatusCode -eq 200) {
      $backendReady = $true
      break
    }
  } catch {}
  Start-Sleep -Milliseconds 500
}

if ($backendReady) {
  Write-Host "       Backend is LIVE at http://localhost:5000" -ForegroundColor Green
} else {
  Write-Host "       [WARN] Backend taking longer to initialize. Check logs\backend.log" -ForegroundColor Yellow
}

Write-Host " [4/4] Starting Frontend (port 3333)..." -ForegroundColor Cyan
Remove-Item -Path "$frontend\node_modules\.vite" -Recurse -Force -ErrorAction SilentlyContinue
$frontCmd = "cd /d `"$frontend`" && npx vite --host 0.0.0.0 --port 3333 > `"$logs\frontend.log`" 2>&1"
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $frontCmd) -WindowStyle Hidden

# Wait for frontend
$frontendReady = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3333' -TimeoutSec 1 -UseBasicParsing
    if ($r.StatusCode -ge 100) { $frontendReady = $true; break }
  } catch {
    try {
      $r = Invoke-WebRequest -Uri 'http://localhost:3333' -TimeoutSec 1 -UseBasicParsing
      if ($r.StatusCode -ge 100) { $frontendReady = $true; break }
    } catch {}
  }
  Start-Sleep -Milliseconds 400
}

if ($frontendReady) {
  Write-Host "       Frontend is LIVE at http://localhost:3333" -ForegroundColor Green
} else {
  Write-Host "       Frontend starting up in background..." -ForegroundColor Yellow
}

Write-Host "`n ================================================================" -ForegroundColor Green
Write-Host "  STATUS   : MK Paper Mill ERP is RUNNING" -ForegroundColor Green
Write-Host " ----------------------------------------------------------------"
Write-Host "  Frontend : http://localhost:3333"
Write-Host "  Backend  : http://localhost:5000"
Write-Host "  Login    : head.store@mkpapermill.com  (Password: Head@1234)"
Write-Host " ================================================================`n"

# Open browser
Start-Process "http://localhost:3333"
