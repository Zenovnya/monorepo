# Поднимает весь локальный dev-стек: БД → миграции → сид → API.
# Использование: powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path $PSScriptRoot -Parent

Write-Host '==> 1/4 PostgreSQL (dev-кластер :5433)'
& (Join-Path $PSScriptRoot 'dev-db.ps1')

Write-Host '==> 2/4 Alembic migrations'
Push-Location (Join-Path $root 'backend')
try {
    cmd /c "python -m alembic upgrade head 2>&1" | Select-Object -Last 2
} finally {
    Pop-Location
}

Write-Host '==> 3/4 API на 0.0.0.0:8000'
& (Join-Path $PSScriptRoot 'dev-api.ps1')

Write-Host '==> 4/4 Сид контента (идемпотентно)'
try {
    $headers = @{ 'X-Admin-Token' = $env:ADMIN_TOKEN }
    if (-not $headers['X-Admin-Token']) { $headers['X-Admin-Token'] = 'lexbear-admin-dev-token' }
    $r = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/lexbear/seed' -Headers $headers -TimeoutSec 60
    Write-Host ("Сид: " + ($r | ConvertTo-Json -Compress -Depth 4))
} catch {
    Write-Host "Сид не выполнен: $($_.Exception.Message)"
}

# Только реальные LAN-адреса: без loopback, link-local, WSL/Hyper-V/VirtualBox,
# VPN и виртуальных адаптеров — телефон по ним не достучится.
$candidates = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.PrefixOrigin -ne 'WellKnown' -and
        $_.InterfaceAlias -notmatch 'Loopback|vEthernet|VirtualBox|VMware|WSL|Docker|Teredo|tun|tap|VPN|Bluetooth'
    } |
    Select-Object IPAddress, InterfaceAlias, PrefixOrigin

# Первыми — Wi-Fi/Ethernet с DHCP (так выдаёт роутер), затем остальные.
$ips = @(
    ($candidates | Where-Object { $_.PrefixOrigin -eq 'Dhcp' } | Select-Object -ExpandProperty IPAddress -Unique)
    ($candidates | Select-Object -ExpandProperty IPAddress -Unique)
) | Select-Object -Unique

Write-Host ''
Write-Host 'API:      http://localhost:8000/docs'
foreach ($ip in $ips) { Write-Host "С телефона: http://${ip}:8000" }
if (-not $ips) { Write-Host 'LAN-адрес не найден — проверьте подключение к Wi-Fi.' }
Write-Host 'Мобильное приложение: cd mobile; npx expo start --lan (телефон в той же Wi-Fi)'
