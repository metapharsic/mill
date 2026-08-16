# MK Paper Mill ERP - Create Complete Portable ZIP Backup
$destinationZip = "C:\MK_Mill\mkmill-software-main\mkmill-software-main\mkmill_complete_backup.zip"
$sourceDir = "C:\MK_Mill\mkmill-software-main\mkmill-software-main"

Write-Host "Creating complete project backup archive at $destinationZip..." -ForegroundColor Cyan

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

Write-Host "Copying core application files, database dumps, and assets..." -ForegroundColor Yellow

$excludeDirs = @('node_modules', '.git', '.system_generated', 'dist')

# Robocopy to stage excluding heavy cache and node_modules
robocopy $sourceDir $stagingDir /E /XD node_modules .git .system_generated dist /XF mkmill_complete_backup.zip *.log | Out-Null

Write-Host "Compressing archive to ZIP..." -ForegroundColor Yellow
Compress-Archive -Path "$stagingDir\*" -DestinationPath $destinationZip -CompressionLevel Optimal

# Cleanup stage
Remove-Item $stagingDir -Recurse -Force

$zipInfo = Get-Item $destinationZip
$sizeMb = [math]::Round($zipInfo.Length / 1MB, 2)
Write-Host "================================================================" -ForegroundColor Green
Write-Host "✅ COMPLETE BACKUP ZIP CREATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "File: $destinationZip ($sizeMb MB)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Green
