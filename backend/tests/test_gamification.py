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

        # add_xp теперь пишет дневной счётчик XP (см. _add_daily_xp).
        async def scalar(self, _query):
            return None

        def add(self, _obj):
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

class TestLessonGems:
    """Гемы за урок.

    До этого гемы начислялись только после оплаты через платёжный шлюз,
    которого в MVP нет (ManualProvider → checkout.invalid). Новый игрок
    навсегда оставался с нулём гемов и не мог ничего купить в магазине.
    """

    def test_first_completion_gives_full_reward(self) -> None:
        from app.modules.content.lexbear_service import _gems_for_lesson

        assert _gems_for_lesson(0.5, is_new=True) == 10
        assert _gems_for_lesson(1.0, is_new=True) == 15

    def test_repeat_completion_gives_reduced_reward(self) -> None:
        """Повторное прохождение нельзя «фармить» на полную награду."""
        from app.modules.content.lexbear_service import _gems_for_lesson

        assert _gems_for_lesson(0.5, is_new=False) == 2
        assert _gems_for_lesson(1.0, is_new=False) == 4
        assert _gems_for_lesson(0.0, is_new=False) >= 1

    def test_shop_items_affordable_with_lesson_gems(self) -> None:
        """Дешёвый товар достижим за разумное число уроков."""
        from app.modules.gamification.service import SHOP_ITEMS

        cheapest = min(SHOP_ITEMS.values())
        lessons_needed = -(-cheapest // 10)  # ceil
        assert lessons_needed <= 10


class TestRepeatCosmeticPurchase:
    """Повторная покупка костюма не должна списывать гемы.

    Раньше ``purchase_shop_item`` списывал цену и просто заново выставлял
    флаг в ``bear_outfit``: за 300 гемов можно было «купить» уже надетый
    цилиндр и не получить ничего.
    """

    def test_owned_item_raises_before_charging(self) -> None:
        from app.modules.gamification.service import ItemAlreadyOwnedError

        assert issubclass(ItemAlreadyOwnedError, Exception)

    @pytest.mark.asyncio
    async def test_repeat_purchase_keeps_gems(self, monkeypatch) -> None:
        import uuid

        from app.modules.gamification import service as gam
        from app.modules.auth.models import User

        user = User(
            id=uuid.uuid4(),
            email="fit@example.com",
            hashed_password="x",
            gems=1000,
            bear_outfit={"top_hat": True},
        )

        class _Session:
            async def get(self, _model, _pk):
                return user

            async def flush(self):
                return None

        async def _noop(_key):
            return None

        monkeypatch.setattr(gam, "cache_delete", _noop)

        with pytest.raises(gam.ItemAlreadyOwnedError):
            await gam.purchase_shop_item(_Session(), user.id, "outfit_top_hat")

        assert user.gems == 1000


class TestStreakFreeze:
    """Купленная «Заморозка стрика» реально закрывает пропуски.

    До правки ``update_streak`` не смотрел на купленные заморозки: товар за
    200 гемов списывал валюту и не влиял ни на что.
    """

    def _user(self, streak, last_day, freezes):
        import uuid

        from app.modules.auth.models import User

        return User(
            id=uuid.uuid4(),
            email="streak@example.com",
            hashed_password="x",
            streak=streak,
            last_active_day=last_day,
            bear_outfit={"streak_freezes": freezes} if freezes else {},
        )

    def test_one_day_gap_keeps_streak_with_freeze(self) -> None:
        from datetime import datetime, timezone

        from app.modules.gamification.service import update_streak

        now = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        # Активность была 15-го, сегодня 17-е → пропущено 16-е.
        user = self._user(5, now - timedelta(days=2), freezes=2)

        assert update_streak(user, now) == 6
        assert user.bear_outfit["streak_freezes"] == 1

    def test_gap_without_freeze_resets_streak(self) -> None:
        from datetime import datetime, timezone

        from app.modules.gamification.service import update_streak

        now = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        user = self._user(5, now - timedelta(days=2), freezes=0)

        assert update_streak(user, now) == 1

    def test_not_enough_freezes_resets_streak(self) -> None:
        from datetime import datetime, timezone

        from app.modules.gamification.service import update_streak

        now = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        # Пропущено 3 дня, заморозка одна.
        user = self._user(7, now - timedelta(days=4), freezes=1)

        assert update_streak(user, now) == 1
        assert user.bear_outfit["streak_freezes"] == 0

    def test_same_day_does_not_consume_freeze(self) -> None:
        from datetime import datetime, timezone

        from app.modules.gamification.service import update_streak

        now = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        user = self._user(4, now, freezes=3)

        assert update_streak(user, now) == 4
        assert user.bear_outfit["streak_freezes"] == 3


class TestLives:
    """Жизни тратятся на сервере и восстанавливаются покупкой."""

    def test_spend_lives_never_goes_negative(self) -> None:
        import uuid

        from app.modules.auth.models import User
        from app.modules.gamification.service import spend_lives

        user = User(
            id=uuid.uuid4(), email="lives@example.com", hashed_password="x", lives=2
        )

        assert spend_lives(user, 5) == 0
        assert user.lives == 0

    def test_life_refill_restores_to_max(self) -> None:
        import uuid

        from app.modules.auth.models import User
        from app.modules.gamification.service import MAX_LIVES, _apply_shop_effect

        user = User(
            id=uuid.uuid4(), email="refill@example.com", hashed_password="x", lives=1
        )

        effect = _apply_shop_effect(None, user, "life_refill")
        assert user.lives == MAX_LIVES
        assert effect["restored"] == MAX_LIVES - 1


class TestDailyGoal:
    """Ежедневная цель: daily_goal из онбординга наконец используется."""

    @pytest.mark.asyncio
    async def test_add_xp_accumulates_daily_counter(self) -> None:
        import uuid

        from app.modules.auth.models import User
        from app.modules.gamification import service as gam
        from app.modules.progress.models import DailyXp

        user = User(
            id=uuid.uuid4(),
            email="day@example.com",
            hashed_password="x",
            xp=0,
            level=1,
        )
        row = DailyXp(user_id=user.id, day=gam._today_utc(), xp=10)

        class _Session:
            async def scalar(self, _q):
                return row

            def add(self, _obj):
                pass

            async def flush(self):
                return None

        async def _noop(_key):
            return None

        monkeypatch_target = gam.cache_delete
        gam.cache_delete = _noop
        try:
            await gam.add_xp(_Session(), user, 10, mark_active=False)
            await gam.add_xp(_Session(), user, 5, mark_active=False)
        finally:
            gam.cache_delete = monkeypatch_target

        assert user.xp == 15
        # 10 было в счётчике + 10 + 5 начислено.
        assert row.xp == 25

    @pytest.mark.asyncio
    async def test_daily_progress_reports_remaining(self) -> None:
        import uuid

        from app.modules.auth.models import User
        from app.modules.gamification import service as gam
        from app.modules.progress.models import DailyXp

        user = User(
            id=uuid.uuid4(),
            email="goal@example.com",
            hashed_password="x",
            daily_goal=20,
        )
        row = DailyXp(user_id=user.id, day=gam._today_utc(), xp=15)

        class _Session:
            def __init__(self):
                self.calls = 0

            async def get(self, _model, _pk):
                return user

            async def scalar(self, _q):
                return row

        result = await gam.get_daily_progress(_Session(), user.id)

        assert result["goal"] == 20
        assert result["done"] == 15
        assert result["remaining"] == 5
        assert result["completed"] is False


class TestProfilePatch:
    """PATCH /user/me меняет имя и ежедневную цель.

    Цель дня раньше задавалась только в онбординге, хотя и онбординг, и
    настройки обещали «темп можно изменить в настройках».
    """

    def test_daily_goal_validation_rejects_out_of_range(self) -> None:
        from pydantic import ValidationError

        from app.modules.user.schemas import ProfileIn

        with pytest.raises(ValidationError):
            ProfileIn(daily_goal=0)
        with pytest.raises(ValidationError):
            ProfileIn(daily_goal=10_000)

    def test_profile_patch_fields_are_optional(self) -> None:
        from app.modules.user.schemas import ProfileIn

        assert ProfileIn().name is None
        assert ProfileIn().daily_goal is None
        assert ProfileIn(daily_goal=20).daily_goal == 20
        assert ProfileIn(name="Анна").name == "Анна"


class TestLivesRegeneration:
    """Жизни: списание за ошибки, восстановление по таймеру, блокировка урока.

    До этой правки жизни были мёртвой механикой: `spend_lives` уменьшал
    счётчик, но он нигде не проверялся и никогда не восстанавливался.
    """

    def _user(self, lives=5, updated=None) -> User:
        user = _make_user()
        user.lives = lives
        user.lives_updated_at = updated
        return user

    def test_fresh_full_lives_have_no_timer(self) -> None:
        state = service.lives_state(self._user())
        assert state["lives"] == service.MAX_LIVES
        assert state["next_life_in_seconds"] == 0

    def test_spend_lives_sets_timestamp_only_on_first_loss(self) -> None:
        user = self._user()
        service.spend_lives(user, 2)
        first = user.lives_updated_at
        assert user.lives == 3
        assert first is not None

        # Вторая ошибка не сдвигает метку: иначе каждая ошибка отодвигала бы
        # следующую жизнь и игрок не дождался бы восстановления никогда.
        service.spend_lives(user, 1)
        assert user.lives == 2
        assert user.lives_updated_at == first

    def test_regenerate_adds_one_life_per_interval(self) -> None:
        start = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        user = self._user(lives=2, updated=start)

        # Меньше интервала — ничего не восстановилось.
        service.regenerate_lives(user, start + timedelta(minutes=5))
        assert user.lives == 2

        # Ровно интервал — одна жизнь.
        service.regenerate_lives(user, start + timedelta(minutes=20))
        assert user.lives == 3

        # Метка сдвинута ровно на интервал, остаток времени не сгорел.
        assert user.lives_updated_at == start + timedelta(minutes=20)

    def test_regenerate_never_exceeds_max(self) -> None:
        start = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        user = self._user(lives=1, updated=start)

        # Неделя отсутствия не превращается в 500 жизней.
        service.regenerate_lives(user, start + timedelta(days=7))

        assert user.lives == service.MAX_LIVES
        # Запас полный — таймер не нужен.
        assert user.lives_updated_at is None

    def test_next_life_countdown_counts_down(self) -> None:
        start = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        user = self._user(lives=4, updated=start)

        state = service.lives_state(user, start)
        assert state["next_life_in_seconds"] == service.LIFE_REGEN_MINUTES * 60

        state = service.lives_state(user, start + timedelta(minutes=12))
        assert state["next_life_in_seconds"] == 8 * 60

    def test_naive_timestamp_from_sqlite_is_handled(self) -> None:
        """sqlite возвращает naive datetime — не должно падать на вычитании."""
        start = datetime(2026, 11, 17, 12, 0)  # без tzinfo
        user = self._user(lives=3, updated=start)

        service.regenerate_lives(user, datetime(2026, 11, 17, 12, 40, tzinfo=timezone.utc))
        assert user.lives == 5
