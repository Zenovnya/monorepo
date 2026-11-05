"""Бизнес-логика геймификации: уровни, стрики, достижения."""

import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import cache_delete, cache_get, cache_set
from app.modules.auth.models import User, UserAchievement

# Порог XP на один уровень.
XP_PER_LEVEL = 100

# Ключ кэша состояния геймификации.
_GAMIFICATION_CACHE_TTL = 120  # секунды


class GamificationError(Exception):
    """Базовое исключение модуля геймификации."""


class AchievementAlreadyAwardedError(GamificationError):
    """Достижение уже было выдано."""


class InsufficientGemsError(GamificationError):
    """У пользователя недостаточно гемов для покупки."""


class UnknownShopItemError(GamificationError):
    """Товар отсутствует в каталоге магазина."""


# Лиги по возрастанию. Порядок важен: следующая лига считается по индексу.
LEAGUES: tuple[str, ...] = ("Бронза", "Серебро", "Золото", "Мантия", "Фемида")

# Каталог товаров за гемы. Ключ — идентификатор товара из клиента.
SHOP_ITEMS: dict[str, int] = {
    "life_refill": 50,
    "streak_freeze": 200,
    "outfit_top_hat": 300,
    "outfit_judge_robe": 800,
    "chest_xp": 150,
}


def _gamification_cache_key(user_id: uuid.UUID) -> str:
    return f"gamification:{user_id}"


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

    # Инвалидируем кэш состояния геймификации.
    await cache_delete(_gamification_cache_key(user.id))

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

    await cache_delete(_gamification_cache_key(user.id))
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
    """Возвращает сводное состояние геймификации пользователя (с кэшем)."""
    cache_key = _gamification_cache_key(user_id)
    cached = await cache_get(cache_key)
    if cached is not None:
        try:
            return json.loads(cached)
        except (json.JSONDecodeError, TypeError):
            pass

    user = await session.get(User, user_id)
    if user is None:
        raise GamificationError("Пользователь не найден")

    achievements = await list_achievements(session, user_id)
    state = {
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

    await cache_set(cache_key, json.dumps(state), ttl=_GAMIFICATION_CACHE_TTL)
    return state


def next_league(current: str) -> str:
    """Возвращает следующую лигу или текущую, если достигнута последняя."""
    try:
        index = LEAGUES.index(current)
    except ValueError:
        return LEAGUES[0]
    return LEAGUES[min(index + 1, len(LEAGUES) - 1)]


async def get_leaderboard(
    session: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 30,
) -> dict:
    """Возвращает реальную таблицу лидеров лиги пользователя.

    Сортировка — по XP внутри лиги. Пользователи с равным XP получают
    стабильный порядок за счёт сортировки по имени: без этого позиции
    «прыгали» бы между запросами.
    """
    user = await session.get(User, user_id)
    if user is None:
        raise GamificationError("Пользователь не найден")

    rows = await session.scalars(
        select(User)
        .where(
            User.league == user.league,
            User.is_active.is_(True),
        )
        .order_by(User.xp.desc(), User.name.asc())
        .limit(limit)
    )
    users = list(rows.all())

    entries = [
        {
            "position": index + 1,
            "name": row.name or "Юрист",
            "level": row.level,
            "xp": row.xp,
            "is_me": row.id == user.id,
        }
        for index, row in enumerate(users)
    ]

    my_position = next(
        (entry["position"] for entry in entries if entry["is_me"]),
        None,
    )

    return {
        "league": user.league,
        "next_league": next_league(user.league),
        "entries": entries,
        "my_position": my_position,
    }


async def purchase_shop_item(
    session: AsyncSession,
    user_id: uuid.UUID,
    item: str,
) -> dict:
    """Списывает гемы за товар из каталога.

    Проверка баланса и списание выполняются в одной транзакции; при
    недостатке гемов изменения не коммитятся вызывающим роутом.
    """
    price = SHOP_ITEMS.get(item)
    if price is None:
        raise UnknownShopItemError(f"Неизвестный товар: {item}")

    user = await session.get(User, user_id)
    if user is None:
        raise GamificationError("Пользователь не найден")

    if user.gems < price:
        raise InsufficientGemsError("Недостаточно гемов")

    user.gems -= price
    await session.flush()
    await cache_delete(_gamification_cache_key(user.id))

    return {"item": item, "spent": price, "gems": user.gems}
