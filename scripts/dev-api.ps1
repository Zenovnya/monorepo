# Запуск API в отдельном фоне (переживает закрытие терминала).
# Использование: powershell -ExecutionPolicy Bypass -File scripts\dev-api.ps1
#
# ВАЖНО (исправление): раньше скрипт вызывал Start-Process с
# -RedirectStandardOutput/-RedirectStandardError И -PassThru одновременно.
# Uvicorn — долгоживущий процесс: он держит унаследованные дескрипторы
# stdout/stderr открытыми, поэтому PowerShell, ожидая закрытия этих потоков,
# НИКОГДА не завершался. Порт 8000 при этом уже был открыт, но вызывающая
# консоль (и scripts\dev-start.ps1) висели навсегда.
#
# Теперь вывод перенаправляется через cmd-редиректы внутри дочернего
# процесса ("cmd /c ... >log 2>&1"), а Start-Process вызывается без
# -RedirectStandard*/-PassThru — родитель сразу выходит.
param(
    [int]$Port = 8000
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'backend'
$local = Join-Path $root '.local'
New-Item -ItemType Directory -Force -Path $local | Out-Null

$outLog = Join-Path $local 'backend.out.log'
$errLog = Join-Path $local 'backend.err.log'

function Test-Port {
    param([int]$p)
    return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

if (Test-Port -p $Port) {
    $pid0 = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)[0].OwningProcess
    Write-Host "API уже слушает :$Port (pid $pid0)"
    exit 0
}

# Ищем интерпретатор: venv бэкенда -> python из PATH -> py launcher.
$python = $null
foreach ($candidate in @(
    (Join-Path $backend '.venv\Scripts\python.exe'),
    (Join-Path $root '.venv\Scripts\python.exe')
)) {
    if (Test-Path $candidate) { $python = $candidate; break }
}
if (-not $python) {
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { $python = $cmd.Source }
}
if (-not $python) {
    $cmd = Get-Command py -ErrorAction SilentlyContinue
    if ($cmd) { $python = $cmd.Source }
}
if (-not $python) {
    Write-Host 'Python не найден. Установите Python 3.12+ и добавьте его в PATH.'
    exit 1
}
# Проверяем зависимости до старта — иначе получим «не запустился» без причины.
# Импорт делаем из backend/, иначе 'app' не найдётся в sys.path.
Push-Location $backend
try {
    & $python -c 'import uvicorn, app.main' *> $null
    $depsOk = ($LASTEXITCODE -eq 0)
} finally {
    Pop-Location
}
if (-not $depsOk) {
    Write-Host "Не удалось импортировать uvicorn/app.main через $python."
    Write-Host "Установите зависимости: cd backend; $python -m pip install -r requirements.txt"
    exit 1
}

# cmd /c с редиректами: дочерний процесс сам пишет в логи.
#
# ВАЖНО: Start-Process НЕ должен наследовать консольные дескрипторы родителя.
# Если он это делает, то вызывающая сторона (pipe/`| Out-String`, или
# scripts\dev-start.ps1, запущенный из конвейера) ждёт закрытия stdout, а
# долгоживущий uvicorn держит его открытым — консоль виснет навсегда.
# Поэтому запускаем через `cmd /c start "" /b` с редиректами: получатель
# вывода — файл, а не унаследованный хэндл родителя.
$cmdLine = 'start "" /b "{0}" -m uvicorn app.main:app --host 0.0.0.0 --port {1} > "{2}" 2>&1' -f `
    $python, $Port, $errLog

Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', $cmdLine `
    -WorkingDirectory $backend `
    -WindowStyle Hidden | Out-Null

for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Port -p $Port) {
        $apiPid = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)[0].OwningProcess
        Write-Host "API запущен: http://0.0.0.0:$Port (pid $apiPid, лог $errLog)"
        exit 0
    }
}

Write-Host 'API не запустился, последние строки лога:'
Get-Content $errLog -Tail 30 -ErrorAction SilentlyContinue
exit 1
