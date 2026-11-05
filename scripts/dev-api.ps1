# Запуск API в отдельном фоне (переживает закрытие терминала).
# Использование: powershell -ExecutionPolicy Bypass -File scripts\dev-api.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'backend'
$local = Join-Path $root '.local'
New-Item -ItemType Directory -Force -Path $local | Out-Null

$running = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "API уже слушает :8000 (pid $($running[0].OwningProcess))"
    exit 0
}

$proc = Start-Process `
    -FilePath 'python' `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000' `
    -WorkingDirectory $backend `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $local 'backend.out.log') `
    -RedirectStandardError (Join-Path $local 'backend.err.log') `
    -PassThru

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    $health = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    if ($health) {
        Write-Host "API запущен: http://0.0.0.0:8000 (pid $($proc.Id), лог $local\backend.err.log)"
        exit 0
    }
    if ($proc.HasExited) { break }
}

Write-Host 'API не запустился, последние строки лога:'
Get-Content (Join-Path $local 'backend.err.log') -Tail 25
exit 1
