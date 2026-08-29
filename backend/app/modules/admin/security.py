"""Аутентификация служебных (admin) эндпоинтов по статическому токену."""

import hmac

from fastapi import Header, HTTPException, status

from app.config import get_settings

settings = get_settings()


async def require_admin(
    x_admin_token: str | None = Header(default=None),
) -> None:
    """FastAPI-зависимость: пропускает только запросы с валидным admin-токеном.

    Токен задаётся переменной окружения ``ADMIN_TOKEN`` и передаётся клиентом
    в заголовке ``X-Admin-Token``. Сравнение — постоянное по времени
    (защита от тайминг-атаки).

    Поведение при незаданном токене:
    - в ``debug`` (локальная разработка) — доступ разрешён для удобства;
    - в production — доступ запрещён (503), чтобы случайно не открыть админку.
    """
    configured = settings.admin_token
    if not configured:
        if settings.debug:
            return
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Админ-доступ не настроен (ADMIN_TOKEN не задан).",
        )

    if not x_admin_token or not hmac.compare_digest(
        x_admin_token, configured
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или отсутствующий admin-токен.",
        )
