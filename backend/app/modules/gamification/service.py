"""Бизнес-логика геймификации: уровни, стрики, достижения."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User, UserAchievement

# Порог XP на один уровень.
XP_PER_LEVEL = 100


class GamificationError(Exception):
    """Базовое исключение модуля геймификации."""


class AchievementAlreadyAwardedError(GamificationError):
    """Достижение уже было выдано."""


def level_from_xp(xp: int) -> int:
    """Вычисляет уровень по количеству XP."""
    return max(1, xp // XP_PER_LEVEL + 1)


def xp_for_next_level(level: int) -> int:
    """Возвращает XP, необходимые для следующего уровня."""
    return level * XP_PER_LEVEL


def _today_utc() -> datetime:
    """Возвращает начало текущего дня в UTC."""
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def update_streak(user: User, now: datetime | None = None) -> int:
    """Обновляет стрик пользователя при активности в новый день."""
    now = now or datetime.now(timezone.utc)
    today = now.date()
    if user.last_active_day is not None:
        last = user.last_active_day
        if last.date() == today:
            return user.streak  # уже отмечали сегодня
        if last.date() == today - timedelta(days=1):
            user.streak += 1
        else:
            user.streak = 1
    else:
        user.streak = 1
    user.last_active_day = now
    return user.streak


async def add_xp(
    session: AsyncSession,
    user: User,
    amount: int,
    mark_active: bool = True,
) -> dict:
    """Начисляет XP пользователю, обновляет уровень и стрик."""
    if mark_active:
        update_streak(user)

    user.xp += amount
    new_level = level_from_xp(user.xp)
    leveled_up = new_level > user.level
    user.level = new_level
    await session.flush()
    return {
        "xp": user.xp,
        "level": user.level,
        "streak": user.streak,
        "leveled_up": leveled_up,
    }


async def award_achievement(
    session: AsyncSession,
    user: User,
    code: str,
    title: str,
    description: str,
) -> UserAchievement:
    """Выдаёт достижение пользователю (идемпотентно)."""
    existing = await session.scalar(
        select(UserAchievement).where(
            UserAchievement.user_id == user.id,
            UserAchievement.code == code,
        )
    )
    if existing is not None:
        raise AchievementAlreadyAwardedError(
            f"Достижение {code} уже выдано"
        )

    achievement = UserAchievement(
        user_id=user.id,
        code=code,
        title=title,
        description=description,
    )
    session.add(achievement)
    await session.flush()
    return achievement


async def list_achievements(
    session: AsyncSession, user_id: uuid.UUID
) -> list[UserAchievement]:
    """Возвращает список достижений пользователя."""
    result = await session.scalars(
        select(UserAchievement)
        .where(UserAchievement.user_id == user_id)
        .order_by(UserAchievement.awarded_at)
    )
    return list(result.all())


async def get_gamification_state(
    session: AsyncSession, user_id: uuid.UUID
) -> dict:
    """Возвращает сводное состояние геймификации пользователя."""
    user = await session.get(User, user_id)
    if user is None:
        raise GamificationError("Пользователь не найден")

    achievements = await list_achievements(session, user_id)
    return {
        "xp": user.xp,
        "level": user.level,
        "streak": user.streak,
        "gems": user.gems,
        "next_level_xp": xp_for_next_level(user.level),
        "achievements": [
            {
                "code": a.code,
                "title": a.title,
                "description": a.description,
                "awarded_at": a.awarded_at.isoformat(),
            }
            for a in achievements
        ],
    }