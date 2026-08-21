"""Точка входа FastAPI-приложения."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.modules import api_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
)

# Настраиваем CORS только для явно разрешённых источников.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Интеграция Sentry (мониторинг ошибок) — включается при наличии DSN.
if settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

        sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1)
        app.add_middleware(SentryAsgiMiddleware)
    except ImportError:
        # sentry-sdk не установлен — мониторинг выключен.
        pass

app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Health-check эндпоинт для проверки доступности сервиса."""
    return {"status": "ok", "app": settings.app_name}