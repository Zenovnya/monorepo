# Деплой backend (FastAPI) на Railway

Конфигурация для развёртывания бэкенда LexBear на [Railway](https://railway.app).

## Конфигурация

- **Файл конфига:** `backend/railway.json`
- **Dockerfile:** `backend/Dockerfile`
- **Команда запуска:** `sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"`
- **Healthcheck:** `GET /health` (эндпоинт уже реализован в `backend/app/main.py`)

При старте автоматически выполняются миграции Alembic (`alembic upgrade head`), затем запускается приложение Uvicorn.

## Быстрый старт (через панель Railway)

1. Создайте новый проект на [Railway](https://railway.app).
2. Добавьте сервис **New Service → Deploy from GitHub repo** и укажите этот репозиторий.
3. В настройках сервиса задайте **Root Directory = `backend`**.
4. Railway автоматически подхватит `railway.json` и `Dockerfile`.

## Переменные окружения (Environment Variables)

Обязательные переменные задаются в панели **Variables** сервиса:

| Переменная | Описание | Пример |
|---|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL (асинхронный драйвер) | `postgresql+asyncpg://user:pass@host:5432/lexbear` |
| `REDIS_URL` | URL Redis для кэширования | `redis://default:pass@host:6379` |
| `SECRET_KEY` | Секрет для JWT-токенов | — |
| `AMPLITUDE_API_KEY` | API-ключ Amplitude (аналитика) | — |

Опциональные переменные:

| Переменная | Описание |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare R2 — ID аккаунта |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 — Access Key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 — Secret Key |
| `R2_BUCKET_NAME` | Cloudflare R2 — имя bucket |
| `YOOKASSA_SHOP_ID` | ЮKassa — ID магазина |
| `YOOKASSA_SECRET_KEY` | ЮKassa — секретный ключ |
| `RATE_LIMIT_MAX` | Максимум запросов с одного IP за окно (по умолчанию 300) |
| `RATE_LIMIT_WINDOW` | Окно rate-limit в секундах (по умолчанию 60) |

> **Важно:** для PostgreSQL на Railway используйте **совместимый с asyncpg** URL.
> Если используется Supabase, скопируйте строку из раздела *Database → Connection string* (URI) и замените схему на `postgresql+asyncpg://`.

## Защита от перерасхода бесплатного тарифа

- Включён **глобальный rate limiter** (300 запросов/мин с одного IP). Это защищает от спама и резкого расхода кредитов.
- Для ещё большей защиты при большом потоке увеличьте лимиты аккуратно или переходите на платный тариф.
- Рекомендуем настроить **мониторинг расходов** в панели Railway (Alerts → Spending) и следить за лимитами.

## Миграции

Миграции выполняются автоматически перед запуском приложения. Для ручного запуска:

```bash
cd backend
alembic upgrade head
```