"""Тесты health-эндпоинта."""

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    """Health-эндпоинт возвращает статус 200 и корректное тело."""
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"]