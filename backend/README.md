# Backend

FastAPI-сервис с асинхронным SQLAlchemy и миграциями Alembic.

## Технологии

- Python 3.12
- FastAPI
- SQLAlchemy (asyncio) + asyncpg
- Alembic (миграции БД)
- PostgreSQL

## Требования

- Python 3.12+
- PostgreSQL (локально или через Docker)

## Установка

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Конфигурация

Настройки задаются через переменные окружения или файл `.env`:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/sourcecraft
```

По умолчанию подключение идёт к локальному PostgreSQL:

```
postgresql+asyncpg://postgres:postgres@localhost:5432/sourcecraft
```

## Миграции Alembic

Применение миграций:

```bash
cd backend
alembic upgrade head
```

Создание новой миграции при изменении моделей:

```bash
alembic revision --autogenerate -m "описание изменения"
```

Откат на одну ревизию назад:

```bash
alembic downgrade -1
```

## Запуск

```bash
uvicorn app.main:app --reload
```

Приложение будет доступно по адресу http://localhost:8000.