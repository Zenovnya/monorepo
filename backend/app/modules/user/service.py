"""Бизнес-логика пользовательского профиля и мишки Lex."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User


class UserError(Exception):
    """Базовое исключение модуля пользователя."""


async def onboard_user(
    session: AsyncSession,
    user: User,
    *,
    goal: str | None = None,
    minutes: int | None = None,
    codex: str | None = None,
    name: str | None = None,
) -> dict:
    """Завершает онбординг: сохраняет имя, цель и отмечает пройденным."""
    if name and name.strip():
        user.name = name.strip()[:40]
    # 1 минута в день ≈ 2 XP к цели.
    if minutes and minutes > 0:
        user.daily_goal = minutes * 2
    # Кодекс/цель пока не хранятся отдельно — оставляем как подсказку.
    user.onboarded = True
    await session.commit()
    return {"ok": True, "onboarded": True, "daily_goal": user.daily_goal}


async def pet_bear(
    session: AsyncSession,
    user: User,
    pet_count: int,
) -> dict:
    """Погладить мишку: повышает настроение на 5 (до 100)."""
    user.bear_mood = min(100, user.bear_mood + 5)
    await session.commit()
    return {"bear_mood": user.bear_mood, "pet_count": pet_count}