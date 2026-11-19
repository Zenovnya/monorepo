# Railway

Развёртывание backend'а (FastAPI) на [Railway](https://railway.app).

- **Пошаговая инструкция:** [`DEPLOY.md`](DEPLOY.md) — переменные окружения,
  миграции, healthcheck, защита от перерасхода.
- **Конфиг сервиса:** `backend/railway.json`, сборка из `backend/Dockerfile`.
- **Проверка после деплоя:** `GET /health` должен вернуть
  `{"status": "ok", "database": "ok"}`. Если `database` не `ok` — не задан
  `DATABASE_URL` либо он не в формате `postgresql+asyncpg://`.

## Минимум переменных для старта

```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
JWT_SECRET_KEY=<минимум 32 символа, openssl rand -hex 32>
ADMIN_TOKEN=<openssl rand -hex 24>
```

Без `JWT_SECRET_KEY` нужной длины приложение не запустится при `DEBUG=false`.
Redis, R2, ЮKassa, Resend и Amplitude опциональны: без них работают in-memory
кэш, заглушка хранилища и закрытый платёжный шлюз.

Кэш и лимиты запросов работают и без Redis, но тогда они живут в памяти
процесса: при нескольких воркерах лимит становится «на воркер», а не общим.
