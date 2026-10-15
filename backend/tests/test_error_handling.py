"""Tests for safe responses to unexpected application failures."""

from fastapi.testclient import TestClient

from app.main import app


@app.get("/_tests/unhandled-error", include_in_schema=False)
async def raise_unhandled_error() -> None:
    raise RuntimeError("test failure")


def test_unhandled_error_keeps_cors_headers() -> None:
    """A backend failure must not be masked as a CORS error in browsers."""
    origin = "http://192.168.0.108:8081"

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get(
            "/_tests/unhandled-error",
            headers={"Origin": origin},
        )

    assert response.status_code == 500
    assert response.json() == {"detail": "Внутренняя ошибка сервера"}
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"