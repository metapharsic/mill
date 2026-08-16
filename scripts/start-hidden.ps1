param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('backend', 'frontend')]
  [string]$Target,

  [Parameter(Mandatory = $true)]
  [string]$Root
)

$ErrorActionPreference = 'Stop'

$backend = Join-Path $Root 'backend'
$frontend = Join-Path $Root 'frontend'
$logs = Join-Path $Root 'logs'

if (-not (Test-Path $logs)) {
  New-Item -ItemType Directory -Path $logs | Out-Null
}

if ($Target -eq 'backend') {
  $command = "cd /d `"$backend`" && node src/server.js > `"$logs\backend.log`" 2>&1"
} else {
  $command = "cd /d `"$frontend`" && npx vite > `"$logs\frontend.log`" 2>&1"
}

Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $command) -WindowStyle Hidden
