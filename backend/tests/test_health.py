"""Тесты health-эндпоинта."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    """Health-эндпоинт возвращает статус 200 и корректное тело."""
    # Подменяем подключение к БД: в CI реальной базы нет, поэтому
    # имитируем успешный запрос SELECT 1, чтобы health вернул "ok".
    fake_conn = AsyncMock()
    fake_conn.__aenter__.return_value = fake_conn

    with patch("app.main.engine") as fake_engine:
        fake_engine.connect.return_value = fake_conn

        response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"]