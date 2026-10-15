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

Для Expo Web, открытого с другого устройства в локальной сети, разрешите
origin dev-сервера явно или регулярным выражением:

```bash
CORS_ORIGINS='["http://localhost:8081","http://192.168.0.108:8081"]'
# либо для меняющегося адреса в этой локальной подсети:
CORS_ORIGIN_REGEX='^http://192\.168\.0\.\d{1,3}:8081$'
```

В production рекомендуется задавать точный `CORS_ORIGINS`, а regex оставлять
пустым.

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

После миграций заполните минимальный валидированный Case Bank:

```bash
python -m app.seed
```

Команда идемпотентна и создаёт стартовый домен, компетенцию и опубликованный кейс
только при отсутствии записи `police-contact`.

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