"""Глобальный rate limiter для защиты API от спама и перерасхода ресурсов.

Работает как Starlette middleware и ограничивает число запросов с одного IP
в скользящем окне времени. Состояние хранится в памяти процесса.

Внимание: при горизонтальном масштабировании (несколько воркеров) состояние
должно храниться во внешнем хранилище (например, Redis). Для одиночного
контейнера на Railway этого достаточно.
"""

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


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
        self._requests: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()

        queue = self._requests[client_ip]
        # Убираем устаревшие записи (вне окна).
        while queue and now - queue[0] > self.window_seconds:
            queue.popleft()

        if len(queue) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Слишком много запросов. Попробуйте позже."
                },
            )

        queue.append(now)
        response = await call_next(request)
        return response