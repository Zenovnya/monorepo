"""Юнит-тесты модуля платежей."""

import uuid

import pytest

from app.modules.payments import service
from app.modules.payments.models import PaymentHistory


class FakeScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items

    def one_or_none(self):
        return self._items[0] if self._items else None


class FakeSession:
    def __init__(self):
        self._objects = {}
        self.added = []
        self.committed = False

    def _all_of(self, model):
        return list(self._objects.get(model, {}).values())

    def add_model(self, obj):
        self._objects.setdefault(type(obj), {})[obj.id] = obj

    def add(self, obj):
        self.added.append(obj)
        if getattr(obj, "id", None) is not None:
            self._objects.setdefault(type(obj), {})[obj.id] = obj

    async def get(self, model, ident):
        return self._objects.get(model, {}).get(ident)

    async def scalars(self, statement):
        entity = statement.column_descriptions[0]["entity"]
        return FakeScalarResult(self._all_of(entity))

    async def commit(self):
        self.committed = True


@pytest.fixture()
def session():
    return FakeSession()


async def test_create_payment_monthly(session):
    user_id = uuid.uuid4()
    result = await service.create_payment(session, user_id, "monthly")
    assert result["status"] == "pending"
    assert result["payment_id"]
    assert "confirmation_url" in result
    assert session.committed


async def test_create_payment_unknown_plan_raises(session):
    with pytest.raises(service.PlanNotFoundError):
        await service.create_payment(session, uuid.uuid4(), "lifetime")


async def test_is_premium_without_subscription(session):
    assert await service.is_premium(session, uuid.uuid4()) is False


async def test_confirm_payment_activates_subscription(session):
    user_id = uuid.uuid4()
    payment = await service.create_payment(session, user_id, "monthly")
    pid = payment["payment_id"]

    # Находим запись истории в "БД".
    history = session._objects[PaymentHistory][pid]
    session._objects[PaymentHistory] = {pid: history}

    await service.confirm_payment(session, pid, paid=True)

    sub = await service.get_subscription(session, user_id)
    assert sub is not None
    assert sub.status == "active"
    assert sub.expires_at is not None


async def test_confirm_payment_missing_raises(session):
    with pytest.raises(service.SubscriptionNotFoundError):
        await service.confirm_payment(session, "nonexistent", paid=True)


def test_verify_signature():
    # Пустой секрет -> не проходит.
    assert service._verify_signature(b"{}", "sig") is False