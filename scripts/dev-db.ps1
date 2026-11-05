# Локальная dev-БД без пароля администратора PostgreSQL:
# поднимает отдельный кластер на порту 5433 (данные в .local/pgdata).
# Использование: powershell -ExecutionPolicy Bypass -File scripts\dev-db.ps1
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8

$pgBin = 'C:\Program Files\PostgreSQL\16\bin'
if (-not (Test-Path "$pgBin\pg_ctl.exe")) {
    Write-Host "Не найден PostgreSQL 16 в $pgBin — поправьте $pgBin в этом скрипте."
    exit 1
}
$root = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $root '.local\pgdata'
$logFile = Join-Path $root '.local\pg.log'
$port = 5433

New-Item -ItemType Directory -Force -Path (Join-Path $root '.local') | Out-Null

if (-not (Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
    & "$pgBin\initdb.exe" -D $dataDir -U postgres -A trust -E UTF8 | Out-Null
}

# Разрешаем подключения с любого адреса в локальной сети (trust — только dev).
$hba = Join-Path $dataDir 'pg_hba.conf'
$lines = Get-Content $hba
if (-not ($lines -match '^host\s+all\s+all\s+0\.0\.0\.0/0\s+trust')) {
    Add-Content $hba "`nhost all all 0.0.0.0/0 trust`nhost all all ::/0 trust"
}

# Код возврата pg_isready: 0 — принимает подключения (сообщение локализовано).
$ready = & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $port 2>&1
if ($LASTEXITCODE -ne 0) {
    # stderr от pg_ctl перехватываем, иначе PowerShell 5.1 превращает его
    # в исключение из-за $ErrorActionPreference='Stop'.
    & "$pgBin\pg_ctl.exe" -D $dataDir -l $logFile -o "-p $port -c listen_addresses=*" start *>&1 | Out-Null
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $port *> $null
        if ($LASTEXITCODE -eq 0) { break }
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "PostgreSQL не запустился, лог ${logFile}:"
        Get-Content $logFile -Tail 20 -ErrorAction SilentlyContinue
        exit 1
    }
}

$roleExists = (& "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $port -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='lexbear'").Trim()
if ($roleExists -ne '1') {
    & "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $port -d postgres -c "CREATE ROLE lexbear LOGIN PASSWORD 'lexbear_dev_pass' CREATEDB" | Out-Null
}
$dbExists = (& "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $port -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='lexbear'").Trim()
if ($dbExists -ne '1') {
    & "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $port -d postgres -c "CREATE DATABASE lexbear OWNER lexbear" | Out-Null
}

Write-Host "DB ready on port $port (pgdata: $dataDir)"
