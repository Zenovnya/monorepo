"""Бизнес-логика модуля уведомлений."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification, PushToken


async def register_push_token(
    session: AsyncSession,
    user_id: uuid.UUID,
    token: str,
    platform: str | None = None,
) -> PushToken:
    """Регистрирует push-токен устройства пользователя."""
    existing = await session.scalar(
        select(PushToken).where(PushToken.token == token)
    )
    if existing is not None:
        existing.is_active = True
        existing.platform = platform or existing.platform
        return existing

    push_token = PushToken(
        user_id=user_id,
        token=token,
        platform=platform,
        is_active=True,
    )
    session.add(push_token)
    return push_token


async def list_notifications(
    session: AsyncSession, user_id: uuid.UUID
) -> list[Notification]:
    """Возвращает уведомления пользователя, новые сначала."""
    result = await session.scalars(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    return list(result.all())


async def create_notification(
    session: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
) -> Notification:
    """Создаёт уведомление для пользователя."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
    )
    session.add(notification)
    return notification