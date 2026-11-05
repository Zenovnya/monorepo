# Локальная dev-БД без пароля администратора PostgreSQL:
# поднимает отдельный кластер на порту 5433 (данные в .local/pgdata).
# Использование: powershell -ExecutionPolicy Bypass -File scripts\dev-db.ps1
$ErrorActionPreference = 'Stop'

$pgBin = 'C:\Program Files\PostgreSQL\16\bin'
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

$ready = & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $port 2>&1
if ($ready -notmatch 'accepting connections') {
    & "$pgBin\pg_ctl.exe" -D $dataDir -l $logFile -o "-p $port -c listen_addresses=*" start | Out-Null
    Start-Sleep -Seconds 2
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
