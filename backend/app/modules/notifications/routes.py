"""Роуты модуля уведомлений."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.notifications import service
from app.modules.notifications.schemas import PushTokenIn

router = APIRouter(prefix="/notifications", tags=["notifications"])


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


@router.get("")
async def list_notifications(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Возвращает список уведомлений пользователя."""
    user_id = _get_current_user_id(authorization)
    items = await service.list_notifications(session, user_id)
    return {
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "read": n.read,
                "created_at": n.created_at.isoformat(),
            }
            for n in items
        ]
    }


@router.post("/push-token")
async def register_push_token(
    data: PushTokenIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Регистрирует push-токен устройства пользователя."""
    user_id = _get_current_user_id(authorization)
    token = await service.register_push_token(
        session, user_id, data.token, data.platform
    )
    await session.commit()
    return {"ok": True, "token_id": str(token.id)}