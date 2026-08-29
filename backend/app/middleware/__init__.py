"""Глобальный rate limiter для защиты API от спама и перерасхода ресурсов.

Работает как Starlette middleware и ограничивает число запросов с одного IP
в скользящем окне времени. Состояние хранится в Redis (общее для всех
воркеров) с автоматическим откатом на память процесса при недоступности Redis
— см. ``app.ratelimit``.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.ratelimit import check_rate_limit


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    """Ограничивает число запросов с одного IP за окно времени."""

    def __init__(
        self,
        app,
        *,
        max_requests: int = 300,
        window_seconds: int = 60,
    ) -> None:
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def dispatch(self, request, call_next):
        client_ip = request.client.host if request.client else "unknown"

        allowed = await check_rate_limit(
            "global",
            client_ip,
            self.max_requests,
            self.window_seconds,
        )
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Слишком много запросов. Попробуйте позже."
                },
            )

        return await call_next(request)
