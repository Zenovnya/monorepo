"""Точка входа FastAPI-приложения."""

import logging
import os
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database import dispose_engine, engine
from app.middleware import GlobalRateLimitMiddleware
from app.modules import api_router

settings = get_settings()
logger = logging.getLogger(__name__)


def is_allowed_origin(origin: str | None) -> bool:
    """Check an origin against the same allowlist used by CORS middleware."""
    if origin is None:
        return False
    if origin in settings.cors_origins:
        return True
    return bool(
        settings.cors_origin_regex
        and re.fullmatch(settings.cors_origin_regex, origin)
    )


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
    # Интерактивная документация и схема доступны только в debug — в проде
    # не раскрываем структуру API публично.
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Log unexpected failures and return a stable response through CORS."""
    logger.exception("Unhandled error while processing %s", request.url.path, exc_info=exc)
    origin = request.headers.get("origin")
    headers = {}
    if is_allowed_origin(origin):
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return JSONResponse(
        status_code=500,
        content={"detail": "Внутренняя ошибка сервера"},
        headers=headers,
    )

# Настраиваем CORS только для явно разрешённых источников.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
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