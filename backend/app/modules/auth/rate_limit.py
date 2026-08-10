"""Простой in-memory rate limiter для защиты auth-эндпоинтов.

Ограничивает число запросов по IP в скользящем окне времени.
Предназначен для защиты от перебора паролей (brute-force).
Внимание: лимитер хранит состояние в памяти процесса и сбрасывается
при перезапуске. Для масштабирования на несколько воркеров следует
заменить на внешнее хранилище (например, Redis).
"""

import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

_requests: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit(max_requests: int, window_seconds: int) -> Callable:
    """Возвращает FastAPI-зависимость, ограничивающую число запросов по IP."""

    def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()

        # Убираем устаревшие записи (вне окна).
        queue = _requests[client_ip]
        while queue and now - queue[0] > window_seconds:
            queue.popleft()

        if len(queue) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много запросов. Попробуйте позже.",
            )

        queue.append(now)

    return dependency


# Например: не более 5 попыток входа с одного IP за 60 секунд.
auth_login_rate_limit = Depends(_rate_limit(max_requests=5, window_seconds=60))
auth_register_rate_limit = Depends(_rate_limit(max_requests=10, window_seconds=60))