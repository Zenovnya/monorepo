# Ставит зависимости (если нужно) и запускает Metro/Expo в LAN-режиме.
# Использование: powershell -ExecutionPolicy Bypass -File scripts\dev-mobile.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
$mobile = Join-Path $root 'mobile'

Push-Location $mobile
try {
    if (-not (Test-Path 'node_modules')) {
        Write-Host '==> npm install (первый запуск, это долго)'
        npm install
    }

    # Явный адрес API полезен, если Metro не подхватывает хост (--tunnel,
    # несколько сетевых интерфейсов). Без него client.js сам возьмёт хост Metro.
    if (-not (Test-Path '.env')) {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
            Select-Object -First 1 -ExpandProperty IPAddress)
        if ($ip) {
            "EXPO_PUBLIC_API_URL=http://${ip}:8000" | Set-Content '.env'
            Write-Host "Создан mobile\.env → http://${ip}:8000"
        }
    }

    Write-Host '==> npx expo start --lan (сканируйте QR в Expo Go)'
    npx expo start --lan --clear
} finally {
    Pop-Location
}
