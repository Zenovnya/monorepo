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

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client() -> TestClient:
    """Возвращает синхронный HTTP-клиент для проверки эндпоинтов."""
    with TestClient(app) as test_client:
        yield test_client