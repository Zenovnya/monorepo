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


class NotificationSettingsRead(BaseModel):
    """Настройки уведомлений пользователя."""

    streak_reminders: bool
    daily_goal_reminders: bool
    review_reminders: bool


class NotificationSettingsIn(BaseModel):
    """Частичное обновление настроек: клиент присылает только изменённое."""

    streak_reminders: bool | None = None
    daily_goal_reminders: bool | None = None
    review_reminders: bool | None = None
