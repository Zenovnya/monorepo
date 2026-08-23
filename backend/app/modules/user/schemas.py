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


class PetBearOut(BaseModel):
    """Результат поглаживания мишки."""

    bear_mood: int
    pet_count: int