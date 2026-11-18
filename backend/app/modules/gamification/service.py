"""Бизнес-логика геймификации: уровни, стрики, достижения."""

import json
import uuid
from datetime import datetime, timezone

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


class ItemAlreadyOwnedError(GamificationError):
    """Предмет гардероба уже куплен — повторная покупка не нужна."""


class UnknownShopItemError(GamificationError):
    """Товар отсутствует в каталоге магазина."""


# Лиги по возрастанию. Порядок важен: следующая лига считается по индексу.
LEAGUES: tuple[str, ...] = ("Бронза", "Серебро", "Золото", "Мантия", "Фемида")

# Каталог товаров за гемы. Ключ — идентификатор товара из клиента.
# Сколько XP даёт сундук chest_xp (отдельно от цены в гемах).
CHEST_XP_BONUS = 100

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


def spend_lives(user: User, amount: int) -> int:
    """Списывает жизни за ошибки, не уходя ниже нуля."""
    user.lives = max(0, (user.lives or 0) - max(0, amount))
    return user.lives


def _streak_freezes(user: User) -> int:
    """Возвращает число купленных заморозок стрика."""
    return int((user.bear_outfit or {}).get("streak_freezes") or 0)


def _consume_streak_freeze(user: User, count: int) -> int:
    """Списывает заморозки стрика (не больше, чем есть)."""
    outfit = dict(user.bear_outfit or {})
    freezes = int(outfit.get("streak_freezes") or 0)
    spent = max(0, min(freezes, count))
    if spent:
        outfit["streak_freezes"] = freezes - spent
        user.bear_outfit = outfit
    return spent


def update_streak(user: User, now: datetime | None = None) -> int:
    """Обновляет стрик пользователя при активности в новый день.

    Если день (или несколько) пропущен, а у пользователя куплены заморозки
    стрика, пропуски закрываются ими: серия сохраняется, заморозки списываются.
    """
    now = now or datetime.now(timezone.utc)
    today = now.date()
    if user.last_active_day is not None:
        last = user.last_active_day
        if last.date() == today:
            return user.streak  # уже отмечали сегодня
        gap = (today - last.date()).days
        if gap == 1:
            user.streak += 1
        else:
            # gap - 1 пропущенных дней (сегодняшний не в счёт).
            # Раньше стрик просто сбрасывался в 1, а купленная за 200 гемов
            # «Заморозка стрика» не использовалась ни при каких условиях.
            missed = gap - 1
            covered = _consume_streak_freeze(user, missed)
            if covered >= missed:
                # Все пропуски закрыты заморозками — серия продолжается.
                user.streak += 1
            else:
                # Заморозок не хватило (или их нет) — серия начинается заново.
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
        "lives": user.lives,
        "streak_freezes": _streak_freezes(user),
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

    # Косметику нельзя купить дважды: раньше повторная покупка списывала
    # гемы и просто выставляла тот же флаг, то есть забирала валюту впустую.
    if item in _OUTFITS and (user.bear_outfit or {}).get(_OUTFITS[item]):
        raise ItemAlreadyOwnedError("Этот предмет уже есть в гардеробе")

    user.gems -= price
    effect = _apply_shop_effect(session, user, item)
    await session.flush()
    await cache_delete(_gamification_cache_key(user.id))

    return {
        "item": item,
        "spent": price,
        "gems": user.gems,
        "effect": effect,
    }


# Максимум жизней (совпадает с default у User.lives).
MAX_LIVES = 5

# Косметика попадает в bear_outfit под этими ключами.
_OUTFITS = {
    "outfit_top_hat": "top_hat",
    "outfit_judge_robe": "judge_robe",
}


def _apply_shop_effect(session, user: User, item: str) -> dict:
    """Применяет эффект купленного товара к пользователю.

    До этой правки покупка только списывала гемы: пользователь платил
    (в том числе реальными деньгами через пакеты гемов) и не получал ничего.
    """
    if item == "life_refill":
        before = user.lives or 0
        user.lives = MAX_LIVES
        return {"kind": "lives", "lives": user.lives, "restored": user.lives - before}

    if item == "chest_xp":
        bonus = CHEST_XP_BONUS
        user.xp += bonus
        user.level = level_from_xp(user.xp)
        return {"kind": "xp", "xp": user.xp, "gained": bonus}

    if item in _OUTFITS:
        key = _OUTFITS[item]
        outfit = dict(user.bear_outfit or {})
        outfit[key] = True
        user.bear_outfit = outfit
        # Повторную покупку отсекает ItemAlreadyOwnedError выше, поэтому здесь
        # предмет всегда новый.
        return {"kind": "outfit", "outfit": key, "already_owned": False}

    if item == "streak_freeze":
        # Заморозки стрика кладём в то же расширяемое JSON-поле, что и одежду:
        # миграция не нужна, структура не конфликтует с outfit-ключами.
        outfit = dict(user.bear_outfit or {})
        freezes = int(outfit.get("streak_freezes") or 0)
        outfit["streak_freezes"] = freezes + 1
        user.bear_outfit = outfit
        return {"kind": "streak_freeze", "count": outfit["streak_freezes"]}

    # Неизвестный товар отсекается выше (UnknownShopItemError), сюда не попадаем.
    return {"kind": "none"}
