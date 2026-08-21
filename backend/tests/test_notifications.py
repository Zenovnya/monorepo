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