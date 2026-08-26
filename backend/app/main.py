"""Точка входа FastAPI-приложения."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.database import dispose_engine, engine
from app.middleware import GlobalRateLimitMiddleware
from app.modules import api_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Жизненный цикл приложения: корректное завершение пулов соединений."""
    yield
    # Graceful shutdown: закрываем пул БД и соединение Redis.
    from app.cache import close_redis

    await dispose_engine()
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)

# Настраиваем CORS только для явно разрешённых источников.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Глобальный rate limiter: защита от спама и перерасхода бесплатных лимитов.
# По умолчанию 300 запросов/мин с одного IP. Можно настроить через переменные
# окружения RATE_LIMIT_MAX / RATE_LIMIT_WINDOW.
app.add_middleware(
    GlobalRateLimitMiddleware,
    max_requests=int(os.getenv("RATE_LIMIT_MAX", "300")),
    window_seconds=int(os.getenv("RATE_LIMIT_WINDOW", "60")),
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
    """Health-check эндпоинт.

    Проверяет доступность БД (важно для «пробуждения» спящего Supabase
    на бесплатном тарифе) и возвращает статус приложения.
    """
    db_ok = True
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "app": settings.app_name,
        "database": "ok" if db_ok else "unavailable",
    }