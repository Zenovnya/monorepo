# Ставит зависимости (если нужно) и запускает Metro/Expo в LAN-режиме.
# Использование: powershell -ExecutionPolicy Bypass -File scripts\dev-mobile.ps1
#
# ВАЖНО (исправление): раньше адрес API выбирался как «первый IPv4, кроме
# 127.* и 169.254.*». На машинах с WSL/Hyper-V/VirtualBox первым оказывался
# виртуальный адаптер (например 172.27.112.1), и mobile\.env получал адрес,
# недоступный с телефона. Теперь перебираются только реальные LAN-адреса
# (Wi-Fi/Ethernet с DHCP в приоритете), а существующий .env перезаписывается,
# если он указывает на loopback/виртуальный адаптер.
param(
    [string]$ApiUrl,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path $PSScriptRoot -Parent
$mobile = Join-Path $root 'mobile'

function Get-LanIp {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.PrefixOrigin -ne 'WellKnown' -and
            $_.InterfaceAlias -notmatch 'Loopback|vEthernet|VirtualBox|VMware|WSL|Docker|Teredo|tun|tap|VPN|Bluetooth'
        }
    # Сначала DHCP (реальный роутер), затем остальные.
    $dhcp = $candidates | Where-Object { $_.PrefixOrigin -eq 'Dhcp' } |
        Select-Object -First 1 -ExpandProperty IPAddress
    if ($dhcp) { return $dhcp }
    return ($candidates | Select-Object -First 1 -ExpandProperty IPAddress)
}

Push-Location $mobile
try {
    if ((-not (Test-Path 'node_modules')) -or $Force) {
        Write-Host '==> npm install (это долго, один раз)'
        npm install
        if ($LASTEXITCODE -ne 0) { exit 1 }
    } else {
        Write-Host '==> node_modules на месте, npm install пропущен'
    }

    # Явный адрес API полезен, если Metro не подхватывает хост (--tunnel,
    # несколько сетевых интерфейсов). Без него client.js сам возьмёт хост Metro.
    if ($ApiUrl) {
        "EXPO_PUBLIC_API_URL=$ApiUrl" | Set-Content '.env' -Encoding UTF8
        Write-Host "mobile\.env → $ApiUrl (задан параметром)"
    } elseif (Test-Path '.env') {
        $current = (Get-Content '.env' -ErrorAction SilentlyContinue |
            Where-Object { $_ -match '^EXPO_PUBLIC_API_URL=' } |
            Select-Object -First 1) -replace '^EXPO_PUBLIC_API_URL=', ''
        $isVirtual = $current -match '://127\.' -or $current -match '://172\.(1[6-9]|2\d|3[01])\.' -or $current -match '://169\.254\.'
        if ($isVirtual) {
            $ip = Get-LanIp
            if ($ip) {
                "EXPO_PUBLIC_API_URL=http://${ip}:8000" | Set-Content '.env' -Encoding UTF8
                Write-Host "mobile\.env перезаписан (был $current) → http://${ip}:8000"
            } else {
                Write-Host "Внимание: mobile\.env указывает на $current (виртуальный адаптер), LAN-адрес не найден."
            }
        } else {
            Write-Host "mobile\.env уже настроен: $current"
        }
    } else {
        $ip = Get-LanIp
        if ($ip) {
            "EXPO_PUBLIC_API_URL=http://${ip}:8000" | Set-Content '.env' -Encoding UTF8
            Write-Host "Создан mobile\.env → http://${ip}:8000"
        } else {
            Write-Host 'LAN-адрес не найден — телефон не сможет достучаться до API. Проверьте Wi-Fi.'
        }
    }

    Write-Host '==> npx expo start --lan (сканируйте QR в Expo Go)'
    Write-Host '    Телефон должен быть в той же Wi-Fi-сети.'
    npx expo start --lan --clear
} finally {
    Pop-Location
}
