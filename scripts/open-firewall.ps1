# Разрешает входящие подключения к dev-серверам с телефона (Expo Go по Wi-Fi).
# Требует прав администратора: правый клик по PowerShell → «Запуск от имени администратора»,
# затем: powershell -ExecutionPolicy Bypass -File scripts\open-firewall.ps1
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host 'Нужны права администратора: Win+X → «Терминал (Администратор)», затем повторите команду.'
    exit 1
}

foreach ($rule in @(
    @{ Name = 'LexBear API (8000)'; Port = 8000 },
    @{ Name = 'Expo Metro (8081)'; Port = 8081 },
    @{ Name = 'Expo Web (19006)'; Port = 19006 }
)) {
    if (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue) {
        Write-Host "Уже есть: $($rule.Name)"
        continue
    }
    New-NetFirewallRule `
        -DisplayName $rule.Name `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $rule.Port `
        -Profile Private | Out-Null
    Write-Host "Открыт TCP $($rule.Port) для профиля Private: $($rule.Name)"
}
