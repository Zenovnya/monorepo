"""Юнит-тесты геймификации: уровни, стрики, достижения."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.modules.auth.models import User
from app.modules.gamification import service


def _make_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="test@example.com",
        username="Test",
        hashed_password="hash",
        xp=0,
        level=1,
        streak=0,
        gems=0,
    )


def test_level_from_xp() -> None:
    assert service.level_from_xp(0) == 1
    assert service.level_from_xp(99) == 1
    assert service.level_from_xp(100) == 2
    assert service.level_from_xp(250) == 3


def test_update_streak_first_activity() -> None:
    user = _make_user()
    now = datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc)
    streak = service.update_streak(user, now)
    assert streak == 1
    assert user.streak == 1


def test_update_streak_consecutive_days() -> None:
    user = _make_user()
    d1 = datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc)
    d2 = datetime(2026, 1, 11, 9, 0, tzinfo=timezone.utc)
    service.update_streak(user, d1)
    streak = service.update_streak(user, d2)
    assert streak == 2


def test_update_streak_same_day_no_increment() -> None:
    user = _make_user()
    d1 = datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc)
    d2 = datetime(2026, 1, 10, 18, 0, tzinfo=timezone.utc)
    service.update_streak(user, d1)
    streak = service.update_streak(user, d2)
    assert streak == 1  # не увеличился повторно


def test_update_streak_resets_after_gap() -> None:
    user = _make_user()
    d1 = datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc)
    d_gap = datetime(2026, 1, 13, 12, 0, tzinfo=timezone.utc)  # пропуск 2 дней
    service.update_streak(user, d1)
    streak = service.update_streak(user, d_gap)
    assert streak == 1  # сброс


async def test_add_xp_levels_up() -> None:
    class FakeSession:
        async def flush(self):
            pass

    user = _make_user()
    result = await service.add_xp(FakeSession(), user, 250, mark_active=False)
    assert result["xp"] == 250
    assert result["level"] == 3
    assert result["leveled_up"] is True


def test_award_achievement_idempotent() -> None:
    # Проверяем, что повторная выдача одного кода вызывает исключение.
    class FakeResult:
        def __init__(self, val):
            self._val = val

        def one_or_none(self):
            return self._val

    class FakeSession:
        def __init__(self):
            self.awarded = False

        async def scalar(self, stmt):
            return self.awarded if self.awarded else None

        def add(self, obj):
            self.awarded = True

        async def flush(self):
            pass

    user = _make_user()
    sess = FakeSession()

    async def run():
        await service.award_achievement(sess, user, "friend_lex", "Друг Lex", "desc")
        with pytest.raises(service.AchievementAlreadyAwardedError):
            await service.award_achievement(sess, user, "friend_lex", "Друг Lex", "desc")

    import asyncio

    asyncio.run(run())