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
function Test-PgReady {
    param([int]$p)
    # -t 10: при аварийном восстановлении кластер отвечает не сразу;
    # короткий таймаут давал ложное «не отвечает» и мешал определить готовность.
    & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $p -t 10 *> $null
    return ($LASTEXITCODE -eq 0)
}

# ВАЖНО (исправление зависания). Раньше здесь вызывался `pg_ctl start` всякий раз,
# когда pg_isready не отвечал «0». Но pg_ctl при живом (или полу-живом) кластере
# задаёт ИНТЕРАКТИВНЫЙ вопрос:
#     «возможно, уже работает другой сервер; всё же пробуем запустить этот сервер»
#     «Другой экземпляр postmaster ... работает с каталогом данных ...? (Y/N)»
# В консоли пользователя stdin — это терминал, поэтому uvicorn/скрипт «висел вечно»
# ровно на этих строках сразу после «PostgreSQL bin: ...».
#
# Решение из двух частей:
#   1) сначала определяем состояние через `pg_ctl status` (не задаёт вопросов);
#   2) запускаем строго с `-w` (ждать готовности) и с stdin, взятым из $null,
#      чтобы любой возможный запрос получил EOF, а не блокировал консоль.
$statusProbe = & "$pgBin\pg_ctl.exe" status -D $dataDir *>&1 | Out-String
$isRunning = ($LASTEXITCODE -eq 0)

# Если кластер НЕ числится запущенным, но в каталоге остался postmaster.pid —
# это «мусор» от прошлого аварийного завершения. Именно он заставляет pg_ctl
# при старте задавать вопрос «…всё же пробуем? (Y/N)». Сносим его заранее.
$pidFile = Join-Path $dataDir 'postmaster.pid'
if ((-not $isRunning) -and (Test-Path $pidFile)) {
    Write-Host 'Найден устаревший postmaster.pid — удаляю (остался после аварии).'
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

if (-not (Test-PgReady -p $Port)) {
    # Даём кластеру шанс: после нештатного завершения он может ещё
    # восстанавливаться по WAL и временно не принимать подключения.
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-PgReady -p $Port) { break }
    }
}

if (-not (Test-PgReady -p $Port)) {
    if ($isRunning) {
        # Кластер жив, но не принимает подключения на нужном порту: почти всегда
        # он поднят на другом порту. Не пытаемся «стартовать поверх» — сообщаем.
        Write-Host "Кластер уже запущен, но не отвечает на порту $Port."
        Write-Host "Проверьте его состояние:"
        Write-Host "  `"$pgBin\pg_ctl.exe`" status -D `"$dataDir`""
        Write-Host 'Остановите его и запустите снова:'
        Write-Host "  `"$pgBin\pg_ctl.exe`" -D `"$dataDir`" stop"
        exit 1
    }

    # ЗАПУСК. Критично: `pg_ctl start` при «подозрении», что уже работает
    # другой postmaster (оставшийся postmaster.pid, зомби-процесс), задаёт
    # вопрос «всё же пробуем запустить? (Y/N)» и ЖДЁТ ВВОДА. Флаг -w этот
    # вопрос НЕ отключает, поэтому запуск через конвейер PowerShell всё равно
    # «висел вечно». Запускаем через Start-Process с stdin из пустого файла и
    # жёстким таймаутом: вопрос получает EOF (то есть «нет»), а зависание
    # невозможно.
    $startArgs = @(
        '-D', "`"$dataDir`"",
        '-l', "`"$logFile`"",
        '-o', "`"-p $Port -c listen_addresses=*`"",
        '-w', '-t', '30', 'start'
    )
    # Пустой файл вместо stdin: любой вопрос pg_ctl получает EOF.
    # (Start-Process НЕ принимает 'NUL' в -RedirectStandardInput — ему нужен
    #  реальный путь к файлу, иначе падает с FileNotFoundException.)
    $emptyStdin = Join-Path $root '.local\empty-stdin.txt'
    Set-Content $emptyStdin -Value '' -NoNewline -Encoding ASCII
    $ctlOut = Join-Path $root '.local\pgctl.out.log'
    $ctlErr = Join-Path $root '.local\pgctl.err.log'

    $proc = Start-Process -FilePath "$pgBin\pg_ctl.exe" -ArgumentList $startArgs `
        -NoNewWindow -PassThru -RedirectStandardInput $emptyStdin `
        -RedirectStandardOutput $ctlOut -RedirectStandardError $ctlErr
    if (-not $proc.WaitForExit(45000)) {
        $proc.Kill()
        Write-Host 'pg_ctl start не завершился за 45 с — смотрите .local\pgctl.err.log'
        Get-Content $ctlErr -Tail 20 -ErrorAction SilentlyContinue
        exit 1
    }

    for ($i = 0; $i -lt 30; $i++) {
        if (Test-PgReady -p $Port) { break }
        Start-Sleep -Milliseconds 500
    }
    if (-not (Test-PgReady -p $Port)) {
        Write-Host "PostgreSQL не запустился, лог ${logFile}:"
        Get-Content $logFile -Tail 20 -ErrorAction SilentlyContinue
        Write-Host 'Вывод pg_ctl:'
        Get-Content $ctlErr -Tail 10 -ErrorAction SilentlyContinue
        exit 1
    }
}

function Invoke-Psql {
    param([string]$Sql)
    $out = & "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $Port -d postgres -tAc $Sql 2>&1 | Out-String
    return $out.Trim()
}

# Роль и БД: каждый запрос ограничен по времени, чтобы скрипт не «висел»
# на неожиданном запросе пароля или занятой БД.
if ((Invoke-Psql "SELECT 1 FROM pg_roles WHERE rolname='lexbear'") -ne '1') {
    $null | & "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $Port -d postgres -w `
        -c "CREATE ROLE lexbear LOGIN PASSWORD 'lexbear_dev_pass' CREATEDB" | Out-Null
}
if ((Invoke-Psql "SELECT 1 FROM pg_database WHERE datname='lexbear'") -ne '1') {
    $null | & "$pgBin\psql.exe" -U postgres -h 127.0.0.1 -p $Port -d postgres -w `
        -c "CREATE DATABASE lexbear OWNER lexbear" | Out-Null
}

Write-Host "DB ready on port $Port (pgdata: $dataDir)"
