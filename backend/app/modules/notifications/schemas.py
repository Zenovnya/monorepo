"""Pydantic-схемы модуля уведомлений."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class PushTokenIn(BaseModel):
    """Регистрация push-токена."""

    token: str
    platform: str | None = None


class NotificationRead(BaseModel):
    """Уведомление пользователя."""

    id: uuid.UUID
    type: str
    title: str
    body: str
    read: bool
    created_at: datetime