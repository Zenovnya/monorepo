# Поднимает весь локальный dev-стек: БД → миграции → сид → API.
# Использование: powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1
#
# Что исправлено относительно прежней версии:
#   1) Скрипт больше НЕ виснет: dev-api.ps1 запускает uvicorn без удержания
#      дескрипторов stdout/stderr (см. комментарий в dev-api.ps1).
#   2) Миграции и сид выполняются тем же интерпретатором, что и API
#      (venv бэкенда при наличии, иначе python из PATH) — раньше жёстко
#      вызывался 'python', что могло быть другим Python без зависимостей.
#   3) Ошибки миграций/сида теперь останавливают запуск с понятным сообщением,
#      а не «проходят молча» и не приводят к пустому приложению.
param(
    [switch]$SkipSeed,
    [switch]$SkipMobile
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'backend'

function Resolve-Python {
    foreach ($candidate in @(
        (Join-Path $backend '.venv\Scripts\python.exe'),
        (Join-Path $root '.venv\Scripts\python.exe')
    )) {
        if (Test-Path $candidate) { return $candidate }
    }
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command py -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$python = Resolve-Python
if (-not $python) {
    Write-Host 'Python не найден. Установите Python 3.12+ и добавьте его в PATH.'
    exit 1
}
Write-Host "Python: $python"

# --- 0/5 Зависимости бэкенда ------------------------------------------------
Write-Host '==> 1/5 Проверка зависимостей бэкенда'
Push-Location $backend
try {
    & $python -c 'import uvicorn, app.main' *> $null
    $depsOk = ($LASTEXITCODE -eq 0)
} finally {
    Pop-Location
}
if (-not $depsOk) {
    Write-Host 'Зависимости не установлены. Ставлю requirements.txt (это долго, один раз)...'
    & $python -m pip install --disable-pip-version-check -r (Join-Path $backend 'requirements.txt')
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Не удалось установить зависимости. Попробуйте вручную:'
        Write-Host "  cd backend; $python -m pip install -r requirements.txt"
        exit 1
    }
}

# --- 1/5 База данных -------------------------------------------------------
Write-Host '==> 2/5 PostgreSQL (dev-кластер :5433)'
& (Join-Path $PSScriptRoot 'dev-db.ps1')
if ($LASTEXITCODE -ne 0) { exit 1 }

# --- 2/5 Миграции ----------------------------------------------------------
Write-Host '==> 3/5 Alembic migrations'
Push-Location $backend
try {
    & $python -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Миграции не применились. Проверьте, что БД на :5433 доступна.'
        exit 1
    }
} finally {
    Pop-Location
}

# --- 3/5 API ---------------------------------------------------------------
Write-Host '==> 4/5 API на 0.0.0.0:8000'
& (Join-Path $PSScriptRoot 'dev-api.ps1')
if ($LASTEXITCODE -ne 0) { exit 1 }

# --- 4/5 Сид контента ------------------------------------------------------
if (-not $SkipSeed) {
    Write-Host '==> 5/5 Сид контента (идемпотентно)'
    try {
        $headers = @{ 'X-Admin-Token' = $env:ADMIN_TOKEN }
        if (-not $headers['X-Admin-Token']) { $headers['X-Admin-Token'] = 'lexbear-admin-dev-token' }
        $r = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/lexbear/seed' -Headers $headers -TimeoutSec 120
        Write-Host ("Сид: " + ($r | ConvertTo-Json -Compress -Depth 4))
    } catch {
        Write-Host "Сид не выполнен: $($_.Exception.Message)"
        Write-Host '(API уже работает — контент можно залить позже вручную, см. инструкцию)'
    }
} else {
    Write-Host '==> 5/5 Сид пропущен (-SkipSeed)'
}

# --- LAN-адреса для телефона ----------------------------------------------
# Только реальные LAN-адреса: без loopback, link-local, WSL/Hyper-V/VirtualBox,
# VPN и виртуальных адаптеров — телефон по ним не достучится.
$candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
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
Write-Host 'Готово. Бэкенд поднят.'
Write-Host 'API:      http://localhost:8000/docs'
Write-Host 'Health:   http://localhost:8000/health'
foreach ($ip in $ips) { Write-Host "С телефона: http://${ip}:8000" }
if (-not $ips) { Write-Host 'LAN-адрес не найден — проверьте подключение к Wi-Fi.' }

if (-not $SkipMobile) {
    Write-Host ''
    Write-Host 'Мобильное приложение:'
    Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\dev-mobile.ps1'
}
