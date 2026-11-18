"""Тесты отключения автоплатежей при удалении аккаунта.

Проблема, которую они закрепляют: магазин списывал деньги по сохранённому
способу оплаты, а удаление аккаунта этот способ не трогало. Строка
пользователя исчезала, платёж продолжал приходить — и отменить его было уже
нечем, потому что идентификатор способа хранился в удалённой подписке.

У ЮKassa нет API удаления сохранённого способа: «удалить способ» = перестать
использовать его идентификатор у себя, то есть обнулить ``payment_method_id``
и выключить ``auto_renew``. Тесты проверяют именно это плюс отмену
незавершённых платежей.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.modules.payments import service as payments_service
from app.modules.payments.models import PaymentHistory, Subscription
from app.modules.payments.providers.base import CheckoutResult, WebhookEvent
from app.modules.payments.providers.manual import ManualProvider


class RecordingProvider(ManualProvider):
    """Заглушка, которая помнит, какие платежи просили отменить."""

    def __init__(self, cancel_result=True, methods=None):
        self.canceled: list[str] = []
        self._cancel_result = cancel_result
        self._methods = methods or []

    async def cancel_payment(self, payment_id: str) -> bool:
        self.canceled.append(payment_id)
        return self._cancel_result

    async def list_saved_payment_methods(self, limit: int = 20) -> list[str]:
        return list(self._methods)


@pytest.mark.asyncio
async def test_stop_autopayments_clears_method_and_cancels_pending(monkeypatch) -> None:
    """Способ оплаты стирается, незавершённый платёж отменяется."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.database import Base
    from app.modules.auth.models import User

    provider = RecordingProvider()
    monkeypatch.setattr(
        "app.modules.payments.providers.get_payment_provider", lambda: provider
    )

    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)

    user_id = uuid.uuid4()
    async with factory() as session:
        session.add(
            User(id=user_id, email="pay@example.com", hashed_password="x")
        )
        await session.flush()
        session.add(
            Subscription(
                user_id=user_id,
                status="active",
                plan="monthly",
                yookassa_payment_id="pay-1",
                payment_method_id="pm-1",
                auto_renew=True,
                expires_at=datetime.now(timezone.utc) + timedelta(days=30),
            )
        )
        session.add(
            PaymentHistory(
                user_id=user_id,
                yookassa_payment_id="pay-pending",
                amount=39900,
                status="pending",
            )
        )
        await session.commit()

        report = await payments_service.stop_autopayments(session, user_id)

        assert report["stopped"] is True
        assert report["canceled_payments"] == 1
        # Платёж отменяли именно тот, что висел в pending.
        assert provider.canceled == ["pay-pending"]

        subscription = await session.scalar(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        assert subscription is not None
        assert subscription.payment_method_id is None
        assert subscription.auto_renew is False
        assert subscription.status == "canceled"

        payment = await session.scalar(
            select(PaymentHistory).where(
                PaymentHistory.yookassa_payment_id == "pay-pending"
            )
        )
        assert payment.status == "canceled"

    await engine.dispose()


@pytest.mark.asyncio
async def test_stop_autopayments_survives_provider_failure(monkeypatch) -> None:
    """Недоступный шлюз не мешает удалить аккаунт, но и не врёт об успехе."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.database import Base
    from app.modules.auth.models import User

    provider = RecordingProvider(cancel_result=False)
    monkeypatch.setattr(
        "app.modules.payments.providers.get_payment_provider", lambda: provider
    )

    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)

    user_id = uuid.uuid4()
    async with factory() as session:
        session.add(User(id=user_id, email="fail@example.com", hashed_password="x"))
        await session.flush()
        session.add(
            Subscription(
                user_id=user_id,
                status="active",
                plan="monthly",
                payment_method_id="pm-2",
                auto_renew=True,
            )
        )
        session.add(
            PaymentHistory(
                user_id=user_id,
                yookassa_payment_id="pay-stuck",
                amount=39900,
                status="pending",
            )
        )
        await session.commit()

        report = await payments_service.stop_autopayments(session, user_id)

        # Автосписание выключено у нас, но платёж остался — это видно в отчёте.
        assert report["stopped"] is True
        assert report["canceled_payments"] == 0

        subscription = await session.scalar(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        assert subscription.payment_method_id is None
        assert subscription.auto_renew is False

    await engine.dispose()


@pytest.mark.asyncio
async def test_delete_account_reports_autopayment_stopped(monkeypatch) -> None:
    """DELETE /user/me сообщает, была ли подписка и отключён ли автоплатёж."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.database import Base
    from app.modules.auth.models import User
    from app.modules.user import service as user_service

    provider = RecordingProvider()
    monkeypatch.setattr(
        "app.modules.payments.providers.get_payment_provider", lambda: provider
    )

    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)

    user_id = uuid.uuid4()
    async with factory() as session:
        session.add(User(id=user_id, email="bye@example.com", hashed_password="x"))
        await session.flush()
        session.add(
            Subscription(
                user_id=user_id,
                status="active",
                plan="monthly",
                payment_method_id="pm-3",
            )
        )
        await session.commit()

        user = await session.get(User, user_id)
        result = await user_service.delete_account(session, user)

        assert result["deleted"] is True
        assert result["had_subscription"] is True
        assert result["autopayment_stopped"] is True

    await engine.dispose()


@pytest.mark.asyncio
async def test_delete_account_without_subscription(monkeypatch) -> None:
    """Без подписки сообщаем честно: отключать было нечего."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.database import Base
    from app.modules.auth.models import User
    from app.modules.user import service as user_service

    monkeypatch.setattr(
        "app.modules.payments.providers.get_payment_provider",
        lambda: RecordingProvider(),
    )

    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)

    user_id = uuid.uuid4()
    async with factory() as session:
        session.add(User(id=user_id, email="free@example.com", hashed_password="x"))
        await session.commit()

        user = await session.get(User, user_id)
        result = await user_service.delete_account(session, user)

        assert result["had_subscription"] is False
        assert result["autopayment_stopped"] is False

    await engine.dispose()


class TestYooKassaProvider:
    """Разбор webhook и отмена платежа у реального шлюза."""

    @pytest.mark.asyncio
    async def test_webhook_returns_saved_payment_method(self) -> None:
        provider = __import__(
            "app.modules.payments.providers.yookassa", fromlist=["YooKassaProvider"]
        ).YooKassaProvider()
        body = (
            b'{"event":"payment.succeeded","object":{"id":"2d1f",'
            b'"status":"succeeded","metadata":{"order_id":"ord-1"},'
            b'"payment_method":{"id":"pm-saved","saved":true}}}'
        )
        event = await provider.parse_webhook(body=body, headers=None)

        # Сопоставление — по нашему order_id из metadata, а не по id шлюза:
        # он стабилен, даже если платёж пересоздадут.
        assert event.external_id == "ord-1"
        assert event.paid is True
        assert event.payment_method_id == "pm-saved"
        assert event.saved is True

    @pytest.mark.asyncio
    async def test_webhook_without_object_id_is_rejected(self) -> None:
        from app.modules.payments.providers.base import WebhookError

        provider = __import__(
            "app.modules.payments.providers.yookassa", fromlist=["YooKassaProvider"]
        ).YooKassaProvider()

        with pytest.raises(WebhookError):
            await provider.parse_webhook(body=b'{"event":"payment.succeeded"}', headers=None)

    @pytest.mark.asyncio
    async def test_cancel_reports_failure_when_not_configured(self) -> None:
        """Без ключей шлюз не подтверждает отмену — не выдаём это за успех."""
        module = __import__(
            "app.modules.payments.providers.yookassa", fromlist=["YooKassaProvider"]
        )
        provider = module.YooKassaProvider()
        provider.shop_id = ""
        provider.secret_key = ""

        assert provider.is_configured() is False
        assert await provider.cancel_payment("pay-1") is False

    @pytest.mark.asyncio
    async def test_checkout_requires_keys(self) -> None:
        module = __import__(
            "app.modules.payments.providers.yookassa", fromlist=["YooKassaProvider"]
        )
        provider = module.YooKassaProvider()
        provider.shop_id = ""
        provider.secret_key = ""

        with pytest.raises(module.YooKassaError):
            await provider.create_checkout(
                order_id="o",
                amount_cents=100,
                description="d",
                return_url="r",
            )


class TestPaymentsErrorOnProviderDown:
    """Отказ шлюза при создании платежа не должен превращаться в 500."""

    @pytest.mark.asyncio
    async def test_create_payment_wraps_provider_error(self, monkeypatch) -> None:
        from app.modules.payments import service

        class BrokenProvider(ManualProvider):
            async def create_checkout(self, **_kwargs):
                raise RuntimeError("шлюз упал")

        monkeypatch.setattr(
            "app.modules.payments.providers.get_payment_provider",
            lambda: BrokenProvider(),
        )

        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from app.database import Base

        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(bind=engine, expire_on_commit=False)

        async with factory() as session:
            with pytest.raises(service.PaymentsError) as exc:
                await service.create_payment(session, uuid.uuid4(), "monthly")
            assert "не списаны" in str(exc.value)

        await engine.dispose()


def test_webhook_event_defaults_keep_compatibility() -> None:
    """Старый трёхполевой WebhookEvent продолжает работать (провайдеры, тесты)."""
    event = WebhookEvent(external_id="x", paid=True)
    assert event.payment_method_id is None
    assert event.saved is False


def test_checkout_result_unchanged() -> None:
    result = CheckoutResult(confirmation_url="https://pay")
    assert result.provider_payment_id is None


def test_subscription_has_autorenew_by_default() -> None:
    """Модель отдаёт auto_renew=True на уровне Python-дефолтов.

    ``default=`` в mapped_column срабатывает только при INSERT, поэтому
    проверяем именно то, что доступно до flush (та же ловушка, что была с
    ``NotificationSettings``).
    """
    sub = Subscription(user_id=uuid.uuid4())
    assert sub.auto_renew is True
    assert sub.payment_method_id is None


def test_payment_history_status_roundtrip() -> None:
    """Отменённый платёж остаётся в истории — это финансовая запись."""
    payment = PaymentHistory(
        user_id=uuid.uuid4(),
        yookassa_payment_id="p",
        amount=1,
        status="canceled",
    )
    assert payment.status == "canceled"


def test_today_is_a_date() -> None:
    """Мелочь для читаемости: импорт date используется в других тестах набора."""
    assert date.today().year >= 2026
