"""Подключение к базе данных.

Используется асинхронный SQLAlchemy. По умолчанию используется PostgreSQL,
движок можно переопределить через настройку database_url.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=settings.debug)

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