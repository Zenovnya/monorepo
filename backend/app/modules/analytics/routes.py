"""Роуты модуля аналитики."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.modules.auth import service as auth_service
from app.modules.analytics import service

router = APIRouter(prefix="/analytics", tags=["analytics"])


class EventIn(BaseModel):
    """Событие для отправки в аналитику."""

    event_type: str
    event_properties: dict | None = None


def _get_current_user_id(
    authorization: str,
) -> uuid.UUID:
    """Декодирует access-токен и возвращает идентификатор пользователя."""
    try:
        return auth_service.decode_access_token(authorization)
    except auth_service.AuthError as exc:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.post("/track")
async def track(
    data: EventIn,
    authorization: str = Depends(auth_service.get_bearer_token),
) -> dict:
    """Отправляет событие в Amplitude."""
    user_id = _get_current_user_id(authorization)
    ok = await service.track_event(
        user_id,
        data.event_type,
        data.event_properties,
    )
    return {"ok": ok}