"""Тесты CORS для browser-клиента."""

from fastapi.testclient import TestClient


def test_lan_expo_origin_passes_preflight(client: TestClient) -> None:
    """Настроенный LAN-origin Expo Web получает CORS-заголовки."""
    origin = "http://192.168.0.108:8081"

    response = client.options(
        "/auth/register",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"


def test_unknown_origin_is_rejected(client: TestClient) -> None:
    """Origin вне allowlist/regex не получает доступ к API."""
    response = client.options(
        "/auth/register",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers