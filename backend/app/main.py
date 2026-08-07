"""Точка входа FastAPI-приложения."""

from fastapi import FastAPI

from app.config import get_settings
from app.modules import api_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Health-check эндпоинт для проверки доступности сервиса."""
    return {"status": "ok", "app": settings.app_name}