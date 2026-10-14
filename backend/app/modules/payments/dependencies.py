"""Зависимости для проверки премиум-доступа."""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.payments import service as payments_service


def get_current_user_id(
    authorization: str,
) -> uuid.UUID:
    """Возвращает id пользователя из access-токена."""
    try:
        return auth_service.decode_access_token(authorization)
    except auth_service.AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


async def require_premium(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> uuid.UUID:
    """Проверяет, что пользователь имеет активный премиум-доступ.

    Используется как FastAPI-зависимость для premium-эндпоинтов.
    """
    user_id = get_current_user_id(authorization)
    is_premium = await payments_service.is_premium(session, user_id)
    if not is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуется премиум-подписка",
        )
    return user_id