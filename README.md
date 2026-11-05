# LexBear

Мобильный тренажёр английского языка: FastAPI + PostgreSQL (`backend/`),
React Native / Expo (`mobile/`).

## Локальный запуск (Windows)

Требуется: PostgreSQL 16 в `C:\Program Files\PostgreSQL\16\bin`, Python 3.12,
Node.js 20+. Пароль администратора PostgreSQL не нужен — dev-скрипт поднимает
отдельный кластер на порту 5433 с данными в `.local/pgdata`.

### Один раз

```powershell
# 1. В отдельном PowerShell ОТ АДМИНИСТРАТОРА — открыть порты для телефона
powershell -ExecutionPolicy Bypass -File scripts\open-firewall.ps1

# 2. Зависимости backend (из корня репозитория)
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# создайте .env — см. ниже (файл в .gitignore)

# 3. Зависимости мобильного приложения
cd ..\mobile
npm install
```

`backend/.env` для локальной работы:

```ini
DATABASE_URL=postgresql+asyncpg://lexbear:lexbear_dev_pass@127.0.0.1:5433/lexbear
DEBUG=true
JWT_SECRET_KEY=<любая строка от 32 символов>
ADMIN_TOKEN=lexbear-admin-dev-token
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081
RATE_LIMIT_MAX=1000
```

`mobile/.env` создаётся автоматически скриптом (`EXPO_PUBLIC_API_URL`); при
запуске через Expo Go на телефоне он не обязателен — адрес API берётся из
хоста Metro.

### Каждый запуск

```powershell
# БД (:5433) + миграции + API (:8000) + сид контента
powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1

# Во втором терминале — Metro / Expo в локальной сети
powershell -ExecutionPolicy Bypass -File scripts\dev-mobile.ps1
```

На iPhone откройте Expo Go и введите `exp://<ip-компьютера>:8081`
(IP печатает `dev-start.ps1`) либо отсканируйте QR из терминала Metro.
Телефон и компьютер — в одной сети, сеть — профиль «Частная».

> Скрипты `scripts/*.ps1` сохранены в **UTF-8 с BOM**: PowerShell 5.1 без BOM
> читает `.ps1` как ANSI (cp1251), и русские комментарии ломают парсер
> (`В строке отсутствует завершающий символ`). При правке скриптов в редакторе
> сохраняйте кодировку «UTF-8 with BOM».

### Проверка

- `http://localhost:8000/health` → `{"status":"ok","database":"ok"}`
- `http://localhost:8000/docs` → Swagger
- Логи: `.local/backend.out.log`, `.local/backend.err.log`, `.local/pg.log`

### Остановка

```powershell
Get-NetTCPConnection -LocalPort 8000,8081 -State Listen |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force }
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D (Join-Path $PWD '.local\pgdata') stop
```

### Сид контента

Выполняется в `dev-start.ps1`. Перезалить контент из JSON-паков
(`backend/app/content_packs/`):

```powershell
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/lexbear/seed?force=true' `
    -Headers @{ 'X-Admin-Token' = 'lexbear-admin-dev-token' }
```

## Документация

- `docs/architecture.md` — архитектура
- `docs/api.md` — API
- `docs/database.md` — схема БД
- `docs/product.md` — продукт
- `docs/decisions/` — ADR


