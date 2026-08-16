# MK Paper Mill ERP - Automated PowerShell Migration Setup

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  MK PAPER MILL ERP - AUTOMATED SYSTEM MIGRATION SETUP" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "This script configures and verifies the entire ERP on a new machine."
Write-Host ""

# 1. Verify Node.js
try {
    $nodeVer = node -v
    Write-Host "[OK] Node.js Detected: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed! Please install Node.js v18+ from https://nodejs.org" -ForegroundColor Red
    Exit 1
}

# 2. Install Backend Packages
Write-Host "`n[1/4] Installing Backend Dependencies..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot\..\backend"
npm install --no-audit
Pop-Location

# 3. Install Frontend Packages
Write-Host "`n[2/4] Installing Frontend Dependencies..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot\..\frontend"
npm install --no-audit
Pop-Location

# 4. Restore Complete Database
Write-Host "`n[3/4] Restoring PostgreSQL Database & Live Data..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot\.."
node scripts/restore_db.js
Pop-Location

# 5. Build Frontend
Write-Host "`n[4/4] Building Frontend Production Assets..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot\..\frontend"
npm run build
Pop-Location

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "🎉 MIGRATION SETUP COMPLETE!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "To launch the application, run: .\start.bat or Start MK Paper Mill.vbs" -ForegroundColor White
