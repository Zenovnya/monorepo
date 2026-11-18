"""Юнит-тесты модуля уведомлений."""

import uuid

import pytest

from app.modules.notifications import service
from app.modules.notifications.models import Notification, PushToken


class FakeScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items

    def first(self):
        return self._items[0] if self._items else None


class FakeSession:
    def __init__(self):
        self._objects = {}
        self.added = []

    def _all_of(self, model):
        return list(self._objects.get(model, {}).values())

    def add_model(self, obj):
        self._objects.setdefault(type(obj), {})[obj.id] = obj

    def add(self, obj):
        self.added.append(obj)
        if getattr(obj, "id", None) is not None:
            self._objects.setdefault(type(obj), {})[obj.id] = obj

    async def scalars(self, statement):
        entity = statement.column_descriptions[0]["entity"]
        return FakeScalarResult(self._all_of(entity))

    async def scalar(self, statement):
        """Возвращает первую запись сущности (аналог session.scalar)."""
        result = await self.scalars(statement)
        return result.first()


@pytest.fixture()
def session():
    return FakeSession()


async def test_register_push_token_new(session):
    user_id = uuid.uuid4()
    token = await service.register_push_token(session, user_id, "expo-token-1", "android")
    assert token.user_id == user_id
    assert token.token == "expo-token-1"
    assert token.is_active is True


async def test_list_notifications_empty(session):
    result = await service.list_notifications(session, uuid.uuid4())
    assert result == []


async def test_create_notification(session):
    user_id = uuid.uuid4()
    n = await service.create_notification(
        session, user_id, "streak_reminder", "Продолжай", "Не теряй стрик!"
    )
    assert n.type == "streak_reminder"
    assert n.title == "Продолжай"

class TestPushTransport:
    """Транспорт Expo: сообщения, пакеты и обработка мёртвых токенов."""

    def test_build_message_shape(self) -> None:
        from app import push

        message = push.build_message(
            token="ExponentPushToken[abc]",
            title="Стрик",
            body="Не потеряй серию",
            data={"type": "streak_reminder"},
        )

        assert message["to"] == "ExponentPushToken[abc]"
        assert message["title"] == "Стрик"
        assert message["data"]["type"] == "streak_reminder"
        assert message["priority"] == "high"

    def test_chunks_split_by_hundred(self) -> None:
        from app import push

        assert len(list(push._chunks(list(range(250)), 100))) == 3

    @pytest.mark.asyncio
    async def test_invalid_token_detected(self, monkeypatch) -> None:
        """DeviceNotRegistered попадает в invalid_tokens, а не теряется."""
        from app import push

        class _Response:
            status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return {
                    "data": [
                        {"status": "ok", "id": "1"},
                        {
                            "status": "error",
                            "message": "not registered",
                            "details": {"error": "DeviceNotRegistered"},
                        },
                    ]
                }

        class _Client:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, *_args, **_kwargs):
                return _Response()

        monkeypatch.setattr(push.httpx, "AsyncClient", lambda **_: _Client())

        messages = [
            push.build_message(token="ExponentPushToken[ok]", title="a", body="b"),
            push.build_message(token="ExponentPushToken[dead]", title="a", body="b"),
        ]
        result = await push.send_push_messages(messages)

        assert result.sent == 1
        assert result.failed == 1
        assert result.invalid_tokens == ["ExponentPushToken[dead]"]

    @pytest.mark.asyncio
    async def test_network_error_does_not_raise(self, monkeypatch) -> None:
        """Падение Expo не должно ломать рассылку целиком."""
        import httpx

        from app import push

        class _Client:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, *_args, **_kwargs):
                raise httpx.ConnectError("boom")

        monkeypatch.setattr(push.httpx, "AsyncClient", lambda **_: _Client())

        result = await push.send_push_messages(
            [push.build_message(token="t", title="a", body="b")]
        )

        assert result.sent == 0
        assert result.failed == 1


class TestDispatchPlanning:
    """Логика «кому и что отправлять»."""

    def _user(self, **kwargs):
        from app.modules.auth.models import User

        defaults = dict(
            id=uuid.uuid4(),
            email="push@example.com",
            hashed_password="x",
            streak=0,
            daily_goal=0,
            last_active_day=None,
        )
        defaults.update(kwargs)
        return User(**defaults)

    @pytest.mark.asyncio
    async def test_streak_reminder_when_active_yesterday(self) -> None:
        from datetime import datetime, timedelta, timezone

        from app.modules.notifications import dispatch
        from app.modules.notifications.models import NotificationSettings

        now = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        user = self._user(
            streak=5, last_active_day=now - timedelta(days=1), daily_goal=0
        )

        class _Session:
            async def scalar(self, _query):
                return None

        plans = await dispatch._plan_for_user(
            _Session(), user, NotificationSettings(), now.date(), now
        )

        types = [p.type for p in plans]
        assert dispatch.TYPE_STREAK in types

    @pytest.mark.asyncio
    async def test_no_streak_reminder_after_activity_today(self) -> None:
        from datetime import datetime, timezone

        from app.modules.notifications import dispatch
        from app.modules.notifications.models import NotificationSettings

        now = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        user = self._user(streak=5, last_active_day=now, daily_goal=0)

        class _Session:
            async def scalar(self, _query):
                return None

        plans = await dispatch._plan_for_user(
            _Session(), user, NotificationSettings(), now.date(), now
        )

        assert dispatch.TYPE_STREAK not in [p.type for p in plans]

    @pytest.mark.asyncio
    async def test_disabled_type_is_not_planned(self) -> None:
        """Отключённый тип не попадает в план — настройки реально работают."""
        from datetime import datetime, timedelta, timezone

        from app.modules.notifications import dispatch
        from app.modules.notifications.models import NotificationSettings

        now = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        user = self._user(
            streak=5, last_active_day=now - timedelta(days=1), daily_goal=0
        )
        settings = NotificationSettings(streak_reminders=False)

        class _Session:
            async def scalar(self, _query):
                return None

        plans = await dispatch._plan_for_user(
            _Session(), user, settings, now.date(), now
        )

        assert dispatch.TYPE_STREAK not in [p.type for p in plans]
