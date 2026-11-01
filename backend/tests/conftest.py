"""Общие фикстуры для тестов backend.

Используем TestClient от FastAPI/Starlette. Health-эндпоинт не трогает БД,
поэтому тесты не требуют внешних сервисов.
"""

import os

# Задаём безопасный тестовый секрет до импорта приложения, чтобы
# валидация конфигурации (запрет небезопасного секрета) прошла корректно.
# Ключ должен быть не короче 32 символов (см. app/config.py).
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-ci-is-long-enough-123456")
os.environ.setdefault("DEBUG", "false")
os.environ.setdefault(
    "CORS_ORIGIN_REGEX",
    r"^http://192\.168\.0\.\d{1,3}:8081$",
)

import pytest
from fastapi.testclient import TestClient

from app.database import engine
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    """Возвращает синхронный HTTP-клиент для проверки эндпоинтов."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _reset_db_pool() -> None:
    """Сбрасывает пул соединений между тестами.

    ``asyncio_mode = auto`` даёт каждому async-тесту собственный event loop.
    ``AsyncAdaptedQueuePool`` держит asyncpg-соединения, привязанные к loop,
    на котором они были созданы: переиспользование в следующем тесте падает
    с ``Event loop is closed`` / ``NoneType has no attribute 'send'``.
    ``dispose()`` возвращает пул в исходное состояние, не обращаясь к
    закрытому loop (в отличие от ``disconnect()``).
    """
    engine.sync_engine.pool.dispose()
    yield
    engine.sync_engine.pool.dispose()