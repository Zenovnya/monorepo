# Подключение Supabase (PostgreSQL) к backend LexBear

Supabase используется в проекте как **управляемая база данных PostgreSQL** для бэкенда FastAPI.

## Роль Supabase в стеке

В выбранном «Пути Б» (гибридная модель) аутентификация остаётся на стороне нашего FastAPI-бэкенда (JWT). Поэтому Supabase применяется **только как база данных** (managed Postgres), а не как провайдер auth.

## Настройка

### 1. Создание проекта Supabase

1. Зарегистрируйтесь на [supabase.com](https://supabase.com) и создайте новый проект.
2. Выберите регион, ближайший к вашему деплою (Railway).
3. Сохраните **Database Password** — он понадобится для строки подключения.

### 2. Получение строки подключения

1. В панели проекта откройте **Project Settings → Database → Connection string**.
2. Выберите вкладку **URI**.
3. Скопируйте строку вида:
   ```
   postgresql://postgres:PASSWORD@db.HOST.supabase.co:5432/postgres
   ```

### 3. Формирование DATABASE_URL для backend

Наш бэкенд использует асинхронный драйвер `asyncpg`. Поэтому замените схему на `postgresql+asyncpg://`:

```
postgresql+asyncpg://postgres:PASSWORD@db.HOST.supabase.co:5432/postgres
```

Задайте эту строку как переменную `DATABASE_URL` в Railway (или локально в `.env`).

## Миграции

Схема базы создаётся через Alembic. Миграции находятся в `backend/migrations/versions/` (0001–0012).

Применение миграций:

```bash
cd backend
alembic upgrade head
```

> На Railway это выполняется автоматически в команде запуска перед стартом Uvicorn.

## Сид-данные

Контент LexBear (юниты, уроки, теория, вопросы, статьи, кейсы) заполняется сидом. После применения миграций выполните:

```bash
curl -X POST https://<backend-url>/lexbear/seed
```

(эндпоинт авторизован — передайте заголовок `Authorization: Bearer <token>`).

## Пул-подключения и производительность

- Supabase на бесплатном тарифе поддерживает ограниченное число подключений.
- Backend использует асинхронный пул SQLAlchemy — настройки пула задаются в `backend/app/database.py`.
- При большом количестве пользователей рекомендуется перейти на платный тариф Supabase и увеличить лимит подключений.