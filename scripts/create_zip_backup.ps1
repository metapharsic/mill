# MK Paper Mill ERP - Create Complete Portable ZIP Backup
$destinationZip = "C:\MK_Mill\mkmill-software-main\mkmill-software-main\mkmill_complete_backup.zip"
$sourceDir = "C:\MK_Mill\mkmill-software-main\mkmill-software-main"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "CREATING COMPLETE STANDALONE BACKUP ARCHIVE FOR MK PAPER MILL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Remove old zip if exists
if (Test-Path $destinationZip) {
    Remove-Item $destinationZip -Force
}

# Temporary staging folder
$stagingDir = "$env:TEMP\mkmill_backup_stage"
if (Test-Path $stagingDir) {
    Remove-Item $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingDir | Out-Null

Write-Host "Copying core application files, database SQL dumps, JSON tables, frontend dist, and scripts..." -ForegroundColor Yellow

# Robocopy to stage excluding heavy node_modules, .git, and temporary IDE logs
robocopy $sourceDir $stagingDir /E /XD node_modules .git .system_generated /XF mkmill_complete_backup.zip *.log | Out-Null

Write-Host "Compressing complete chunk into high-efficiency ZIP archive..." -ForegroundColor Yellow
Compress-Archive -Path "$stagingDir\*" -DestinationPath $destinationZip -CompressionLevel Optimal

# Cleanup stage
Remove-Item $stagingDir -Recurse -Force

if (Test-Path $destinationZip) {
    $zipInfo = Get-Item $destinationZip
    $sizeMb = [math]::Round($zipInfo.Length / 1MB, 2)
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "COMPLETE STANDALONE BACKUP ZIP CREATED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "Archive Location: $destinationZip" -ForegroundColor White
    Write-Host "Archive Size:     $sizeMb MB" -ForegroundColor White
    Write-Host "================================================================" -ForegroundColor Green
} else {
    Write-Host "Failed to create ZIP archive!" -ForegroundColor Red
}
