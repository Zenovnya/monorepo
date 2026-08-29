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
_request_count = 0


def _sweep_stale(now: float, window_seconds: int) -> None:
    """Удаляет IP без активных запросов в окне, чтобы словарь не рос вечно."""
    stale = [
        ip
        for ip, q in _requests.items()
        if not q or now - q[-1] > window_seconds
    ]
    for ip in stale:
        del _requests[ip]


def _rate_limit(max_requests: int, window_seconds: int) -> Callable:
    """Возвращает FastAPI-зависимость, ограничивающую число запросов по IP."""

    def dependency(request: Request) -> None:
        global _request_count
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()

        # Периодическая чистка устаревших IP (защита от утечки памяти).
        _request_count += 1
        if _request_count % 1000 == 0:
            _sweep_stale(now, window_seconds)

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