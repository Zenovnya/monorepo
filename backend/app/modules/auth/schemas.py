"""Pydantic-схемы модуля аутентификации."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    """Схема регистрации нового пользователя."""

    email: EmailStr
    username: str | None = Field(default=None, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    """Схема входа пользователя."""

    email: EmailStr
    password: str


class UserRead(BaseModel):
    """Схема представления пользователя (профиль LexBear)."""

    id: uuid.UUID
    email: EmailStr
    username: str | None
    name: str
    is_active: bool
    xp: int
    level: int
    streak: int
    gems: int
    lives: int
    league: str
    daily_goal: int
    onboarded: bool
    bear_mood: int
    bear_hunger: int
    bear_level: int
    bear_outfit: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RefreshRequest(BaseModel):
    """Схема запроса на обновление токенов."""

    refresh_token: str


class LogoutRequest(BaseModel):
    """Схема запроса на выход из системы."""

    refresh_token: str


class TokenPair(BaseModel):
    """Пара токенов доступа и обновления."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessToken(BaseModel):
    """Access-токен при обновлении токенов."""

    access_token: str
    token_type: str = "bearer"