"""Pydantic-схемы модуля геймификации."""

from pydantic import BaseModel, Field


class AchievementRead(BaseModel):
    """Достижение пользователя."""

    code: str
    title: str
    description: str
    awarded_at: str


class GamificationRead(BaseModel):
    """Сводное состояние геймификации пользователя."""

    xp: int
    level: int
    streak: int
    gems: int
    next_level_xp: int
    achievements: list[AchievementRead]


class XpAddIn(BaseModel):
    """Начисление XP (внутреннее использование/тесты)."""

    amount: int = Field(ge=1, le=10000)


class XpAddOut(BaseModel):
    """Результат начисления XP."""

    xp: int
    level: int
    streak: int
    leveled_up: bool