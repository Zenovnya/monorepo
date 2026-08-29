"""Rate limiter для защиты auth-эндпоинтов от перебора паролей (brute-force).

Ограничивает число запросов по IP в скользящем окне. Состояние — в Redis
(общее для всех воркеров) с откатом на память процесса при недоступности
Redis (см. ``app.ratelimit``).
"""

from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from app.ratelimit import check_rate_limit


def _rate_limit(
    namespace: str, max_requests: int, window_seconds: int
) -> Callable:
    """Возвращает async FastAPI-зависимость, ограничивающую число запросов по IP."""

    async def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        allowed = await check_rate_limit(
            namespace, client_ip, max_requests, window_seconds
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много запросов. Попробуйте позже.",
            )

    return dependency


# Например: не более 5 попыток входа с одного IP за 60 секунд.
auth_login_rate_limit = Depends(
    _rate_limit("auth_login", max_requests=5, window_seconds=60)
)
auth_register_rate_limit = Depends(
    _rate_limit("auth_register", max_requests=10, window_seconds=60)
)
