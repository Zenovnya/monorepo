# Локальная dev-БД без пароля администратора PostgreSQL:
# поднимает отдельный кластер на порту 5433 (данные в .local/pgdata).
# Использование: powershell -ExecutionPolicy Bypass -File scripts\dev-db.ps1
#
# ВАЖНО (исправление): раньше путь к бинарникам был жёстко зашит как
# 'C:\Program Files\PostgreSQL\16\bin'. Если у вас другая версия (15/17)
# или нестандартная установка — скрипт молча падал на «Не найден PostgreSQL 16».
# Теперь каталог бинарников ищется автоматически (PATH -> Program Files\PostgreSQL\*
# -> переменная PGBIN).
param(
    [int]$Port = 5433
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8

function Resolve-PgBin {
    # 1) Уже в PATH?
    $ctl = Get-Command pg_ctl -ErrorAction SilentlyContinue
    if ($ctl) { return (Split-Path $ctl.Source -Parent) }

    # 2) Явное переопределение.
    if ($env:PGBIN -and (Test-Path (Join-Path $env:PGBIN 'pg_ctl.exe'))) {
        return $env:PGBIN
    }

    # 3) Program Files\PostgreSQL\<версия>\bin — старшие версии первыми.
    $base = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $base) {
        $found = Get-ChildItem $base -Directory -ErrorAction SilentlyContinue |
            Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending |
            ForEach-Object { Join-Path $_.FullName 'bin' } |
            Where-Object { Test-Path (Join-Path $_ 'pg_ctl.exe') } |
            Select-Object -First 1
        if ($found) { return $found }
    }

    return $null
}

$pgBin = Resolve-PgBin
if (-not $pgBin) {
    Write-Host 'Не найден PostgreSQL (pg_ctl.exe).'
    Write-Host 'Варианты:'
    Write-Host '  1) Установите PostgreSQL 16: https://www.postgresql.org/download/windows/'
    Write-Host '  2) Или укажите каталог bin вручную: $env:PGBIN = "C:\Program Files\PostgreSQL\17\bin"'
    Write-Host '  3) Или поднимите БД в Docker: cd infra\docker; docker compose up -d db'
    exit 1
}
Write-Host "PostgreSQL bin: $pgBin"

$root = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $root '.local\pgdata'
$logFile = Join-Path $root '.local\pg.log'
New-Item -ItemType Directory -Force -Path (Join-Path $root '.local') | Out-Null

if (-not (Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
    Write-Host '==> initdb (первый запуск, создаём кластер в .local\pgdata)'
    & "$pgBin\initdb.exe" -D $dataDir -U postgres -A trust -E UTF8 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'initdb не удался.'
        exit 1
    }
}

# Разрешаем подключения с любого адреса в локальной сети (trust — только dev).
$hba = Join-Path $dataDir 'pg_hba.conf'
$lines = Get-Content $hba
if (-not ($lines -match '^host\s+all\s+all\s+0\.0\.0\.0/0\s+trust')) {
    Add-Content $hba "`nhost all all 0.0.0.0/0 trust`nhost all all ::/0 trust"
}

# Код возврата pg_isready: 0 — принимает подключения (сообщение локализовано).
& "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $Port *> $null
if ($LASTEXITCODE -ne 0) {
    # stderr от pg_ctl перехватываем, иначе PowerShell 5.1 превращает его
    # в исключение из-за $ErrorActionPreference='Stop'.
    & "$pgBin\pg_ctl.exe" -D $dataDir -l $logFile -o "-p $Port -c listen_addresses=*" start *>&1 | Out-Null
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $Port *> $null
        if ($LASTEXITCODE -eq 0) { break }
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "PostgreSQL не запустился, лог ${logFile}:"
        Get-Content $logFile -Tail 20 -ErrorAction SilentlyContinue
        exit 1
    }
}

$roleExists = (& "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $Port -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='lexbear'").Trim()
if ($roleExists -ne '1') {
    & "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $Port -d postgres -c "CREATE ROLE lexbear LOGIN PASSWORD 'lexbear_dev_pass' CREATEDB" | Out-Null
}
$dbExists = (& "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $Port -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='lexbear'").Trim()
if ($dbExists -ne '1') {
    & "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $Port -d postgres -c "CREATE DATABASE lexbear OWNER lexbear" | Out-Null
}

Write-Host "DB ready on port $Port (pgdata: $dataDir)"
