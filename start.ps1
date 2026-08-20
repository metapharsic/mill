# MK Paper Mill — Start backend + frontend
# Run: Right-click → Run with PowerShell  (or: powershell -File start.ps1)

Write-Host "Stopping existing node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

# Set env vars
$env:NODE_ENV   = "development"
$env:PORT       = "5000"
$env:DB_HOST    = "localhost"
$env:DB_PORT    = "5432"
$env:DB_NAME    = "mk_paper_mill"
$env:DB_USER    = "postgres"
$env:DB_PASSWORD= "postgres"
$env:JWT_SECRET = "mk_paper_mill_jwt_secret_change_this"
$env:JWT_EXPIRES_IN = "8h"
$env:CORS_ORIGIN = ""
$env:KAFKA_ENABLED = "false"
$env:KAFKA_BROKERS = "localhost:9092"
$env:FRONTEND_PORT = "3333"

$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

# Start backend in new window
Write-Host "Starting backend on port 5000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$env:NODE_ENV='development';
  `$env:PORT='5000';
  `$env:DB_HOST='localhost';
  `$env:DB_PORT='5432';
  `$env:DB_NAME='mk_paper_mill';
  `$env:DB_USER='postgres';
  `$env:DB_PASSWORD='postgres';
  `$env:JWT_SECRET='mk_paper_mill_jwt_secret_change_this';
  `$env:JWT_EXPIRES_IN='8h';
  `$env:CORS_ORIGIN='';
  `$env:KAFKA_ENABLED='false';
  `$env:KAFKA_BROKERS='localhost:9092';
  Set-Location -Path '$backendDir';
  Write-Host 'Backend starting...' -ForegroundColor Green;
  node src/server.js
" -WindowStyle Normal

Start-Sleep 3

# Start frontend in new window
Write-Host "Starting frontend on port 3333..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$env:FRONTEND_PORT='3333';
  Set-Location -Path '$frontendDir';
  Write-Host 'Frontend starting...' -ForegroundColor Green;
  npm run dev
" -WindowStyle Normal

Start-Sleep 5

# Verify
try {
  $r = Invoke-RestMethod http://localhost:5000/api/auth/login -Method POST -ContentType "application/json" -Body '{"email":"admin@mkpapermill.com","password":"Admin@1234"}'
  if ($r.success) { Write-Host "Backend OK - logged in as $($r.user.name)" -ForegroundColor Green }
} catch {
  Write-Host "Backend not responding yet - wait a few seconds" -ForegroundColor Red
}

Write-Host ""
Write-Host "Open browser: http://localhost:3333" -ForegroundColor White
Write-Host "Default Login: admin@mkpapermill.com / Admin@1234 (Dept Heads: Head@1234)" -ForegroundColor White
