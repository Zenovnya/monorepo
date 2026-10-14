"""Подключение к базе данных.

Используется асинхронный SQLAlchemy. По умолчанию используется PostgreSQL,
движок можно переопределить через настройку database_url.
"""

import os

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Параметры пула подключений настраиваются через переменные окружения
# с разумными дефолтами для PostgreSQL (важно для Supabase с лимитом подключений).
_pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
_max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "5"))
_pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=_pool_size,
    max_overflow=_max_overflow,
    pool_timeout=_pool_timeout,
    # pool_pre_ping защищает от использования оборванных соединений.
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Базовый класс для всех ORM-моделей."""

    pass


async def get_session() -> AsyncSession:
    """FastAPI-зависимость, возвращающая асинхронную сессию БД."""
    async with async_session_factory() as session:
        yield session


async def dispose_engine() -> None:
    """Закрывает пул подключений при graceful shutdown приложения."""
    await engine.dispose()