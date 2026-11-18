"""Роуты модуля уведомлений."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.notifications import service
from app.modules.notifications import dispatch
from app.modules.notifications.schemas import (
    NotificationSettingsIn,
    NotificationSettingsRead,
    PushTokenIn,
)

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


@router.get("/settings", response_model=NotificationSettingsRead)
async def get_notification_settings(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Возвращает настройки уведомлений (создаёт дефолтные при первом запросе)."""
    user_id = _get_current_user_id(authorization)
    settings = await dispatch.get_settings_for_user(session, user_id)
    await session.commit()
    return {
        "streak_reminders": settings.streak_reminders,
        "daily_goal_reminders": settings.daily_goal_reminders,
        "review_reminders": settings.review_reminders,
    }


@router.patch("/settings", response_model=NotificationSettingsRead)
async def update_notification_settings(
    data: NotificationSettingsIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Меняет настройки уведомлений: каждый тип можно отключить отдельно."""
    user_id = _get_current_user_id(authorization)
    settings = await dispatch.get_settings_for_user(session, user_id)

    for field in (
        "streak_reminders",
        "daily_goal_reminders",
        "review_reminders",
    ):
        value = getattr(data, field)
        if value is not None:
            setattr(settings, field, value)

    await session.commit()
    await session.refresh(settings)
    return {
        "streak_reminders": settings.streak_reminders,
        "daily_goal_reminders": settings.daily_goal_reminders,
        "review_reminders": settings.review_reminders,
    }


@router.post("/test")
async def send_test_notification(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Отправляет тестовый push на все устройства пользователя.

    Без этого проверить связку «токен → Expo → устройство» можно было только
    дождавшись cron, поэтому отсутствие push замечали уже после релиза.
    """
    user_id = _get_current_user_id(authorization)
    return await dispatch.send_test_push(session, user_id)
