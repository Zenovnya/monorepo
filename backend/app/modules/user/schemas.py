"""Pydantic-схемы модуля пользовательского профиля."""

from pydantic import BaseModel, Field


class OnboardIn(BaseModel):
    """Схема онбординга пользователя."""

    goal: str | None = Field(default=None, max_length=64)
    minutes: int | None = Field(default=None, ge=1, le=120)
    codex: str | None = Field(default=None, max_length=32)
    name: str | None = Field(default=None, max_length=40)


class OnboardOut(BaseModel):
    """Результат онбординга."""

    ok: bool = True
    onboarded: bool = True
    daily_goal: int


class ProfileIn(BaseModel):
    """Частичное обновление профиля.

    Оба поля необязательны: клиент присылает только то, что меняет.
    """

    name: str | None = Field(default=None, min_length=1, max_length=40)
    # Цель XP в день. Раньше задавалась только в онбординге (минуты × 2),
    # хотя и онбординг, и настройки обещали «темп можно изменить».
    daily_goal: int | None = Field(default=None, ge=1, le=500)


class ProfileOut(BaseModel):
    """Текущий профиль пользователя."""

    name: str
    email: str
    username: str | None = None
    gems: int = 0
    xp: int = 0
    level: int = 1
    streak: int = 0
    lives: int = 5
    league: str = "Бронза"
    daily_goal: int = 10


class PetBearOut(BaseModel):
    """Результат поглаживания мишки."""

    bear_mood: int
    pet_count: int

class DeleteAccountIn(BaseModel):
    """Подтверждение удаления аккаунта.

    Пароль обязателен: удаление необратимо, и одного украденного access-токена
    (у него срок 15 минут) для него недостаточно.
    """

    password: str = Field(min_length=1, max_length=256)


class DeleteAccountOut(BaseModel):
    """Результат удаления аккаунта."""

    deleted: bool = True
    email: str
    leftover_rows: int = 0
