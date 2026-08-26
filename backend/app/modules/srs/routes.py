"""Роуты модуля SRS."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.progress.service import get_reviews_for_user

router = APIRouter(prefix="/srs", tags=["srs"])


def _get_current_user_id(
    authorization: str,
) -> uuid.UUID:
    """Декодирует access-токен и возвращает идентификатор пользователя."""
    try:
        return auth_service.decode_access_token(authorization)
    except auth_service.AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.get("/reviews")
async def list_reviews(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Возвращает список кейсов, подлежащих повторению (по SM-2)."""
    user_id = _get_current_user_id(authorization)
    reviews = await get_reviews_for_user(session, user_id)
    return {"reviews": reviews}