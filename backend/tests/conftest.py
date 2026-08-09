"""Общие фикстуры для тестов backend.

Используем TestClient от FastAPI/Starlette. Health-эндпоинт не трогает БД,
поэтому тесты не требуют внешних сервисов.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client() -> TestClient:
    """Возвращает синхронный HTTP-клиент для проверки эндпоинтов."""
    with TestClient(app) as test_client:
        yield test_client