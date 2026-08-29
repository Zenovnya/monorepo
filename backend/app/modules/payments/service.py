"""Бизнес-логика платежей и подписок (ЮKassa)."""

import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.auth.models import User
from app.modules.payments.models import PaymentHistory, Subscription

settings = get_settings()

# Цены в копейках.
# Подписки LexBear Plus.
PLANS = {
    "monthly": {"type": "subscription", "amount_cents": 39900, "days": 30},
    "yearly": {"type": "subscription", "amount_cents": 299000, "days": 365},
}

# Пакеты гемов (покупка внутри приложения через ЮKassa).
GEM_PLANS = {
    "gems_500": {"type": "gems", "amount_cents": 19900, "gems": 500},
    "gems_1200": {"type": "gems", "amount_cents": 44900, "gems": 1200},
    "gems_3000": {"type": "gems", "amount_cents": 99900, "gems": 3000},
}

ALL_PLANS = {**PLANS, **GEM_PLANS}


class PaymentsError(Exception):
    """Базовое исключение модуля платежей."""


class PlanNotFoundError(PaymentsError):
    """Тариф не найден."""


class SubscriptionNotFoundError(PaymentsError):
    """Подписка не найдена."""


def _verify_signature(payload_body: bytes, signature: str) -> bool:
    """Проверяет подпись webhook от ЮKassa (HMAC-SHA256)."""
    secret = settings.yookassa_webhook_secret
    if not secret:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        payload_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def get_subscription(
    session: AsyncSession, user_id: uuid.UUID
) -> Subscription | None:
    """Возвращает активную подписку пользователя."""
    result = await session.scalars(
        select(Subscription)
        .where(Subscription.user_id == user_id)
        .order_by(Subscription.created_at.desc())
    )
    subs = list(result.all())
    if not subs:
        return None
    # Возвращаем последнюю созданную.
    return subs[0]


async def is_premium(session: AsyncSession, user_id: uuid.UUID) -> bool:
    """Проверяет, имеет ли пользователь активный премиум-доступ."""
    sub = await get_subscription(session, user_id)
    if sub is None:
        return False
    if sub.status != "active":
        return False
    if sub.expires_at is not None and sub.expires_at < datetime.now(timezone.utc):
        return False
    return True


async def create_payment(
    session: AsyncSession,
    user_id: uuid.UUID,
    plan: str,
) -> dict:
    """Создаёт платёж в ЮKassa и сохраняет запись истории.

    Поддерживает подписки (monthly/yearly) и пакеты гемов (gems_*).
    """
    if plan not in ALL_PLANS:
        raise PlanNotFoundError(f"Тариф не найден: {plan}")

    plan_cfg = ALL_PLANS[plan]
    payment_id = str(uuid.uuid4())

    # Сохраняем запись о платеже (pending).
    session.add(
        PaymentHistory(
            user_id=user_id,
            yookassa_payment_id=payment_id,
            amount=plan_cfg["amount_cents"],
            currency="RUB",
            status="pending",
            description=f"{plan_cfg['type']}:{plan}",
        )
    )
    await session.commit()

    # В реальной интеграции здесь был бы POST /v3/payments в ЮKassa.
    # Для MVP возвращаем заглушку confirmation_url.
    confirmation_url = (
        f"https://pay.yookassa.ru/sdk/{payment_id}?lang=ru"
    )

    return {
        "payment_id": payment_id,
        "confirmation_url": confirmation_url,
        "status": "pending",
    }


async def confirm_payment(
    session: AsyncSession,
    yookassa_payment_id: str,
    paid: bool = True,
) -> None:
    """Подтверждает оплату из webhook ЮKassa.

    Для подписки — активирует/продлевает Premium.
    Для пакета гемов — начисляет гемы пользователю.
    """
    history = await session.scalar(
        select(PaymentHistory).where(
            PaymentHistory.yookassa_payment_id == yookassa_payment_id
        )
    )
    if history is None:
        raise SubscriptionNotFoundError("Платёж не найден")

    # Идемпотентность: ЮKassa повторяет webhook при сбоях доставки.
    # Если платёж уже проведён — ничего не начисляем повторно.
    if history.status == "succeeded":
        return

    history.status = "succeeded" if paid else "canceled"
    if paid:
        history.paid_at = datetime.now(timezone.utc)

        # Определяем тип и план из описания (вида "subscription:monthly").
        kind = "subscription"
        plan_key = "monthly"
        if history.description:
            kind_part, _, plan_part = history.description.partition(":")
            if kind_part:
                kind = kind_part
            if plan_part:
                plan_key = plan_part

        user_id = history.user_id
        user = await session.get(User, user_id)

        if kind == "gems":
            # Начисляем гемы пользователю.
            plan_cfg = GEM_PLANS.get(plan_key)
            if plan_cfg and user is not None:
                user.gems = (user.gems or 0) + plan_cfg["gems"]
        else:
            # Подписка: активируем/обновляем премиум.
            plan_cfg = PLANS.get(plan_key, PLANS["monthly"])
            expires_at = datetime.now(timezone.utc) + timedelta(days=plan_cfg["days"])

            existing = await get_subscription(session, user_id)
            if existing is None:
                session.add(
                    Subscription(
                        user_id=user_id,
                        status="active",
                        plan=plan_key,
                        yookassa_payment_id=yookassa_payment_id,
                        expires_at=expires_at,
                    )
                )
            else:
                existing.status = "active"
                existing.plan = plan_key
                existing.yookassa_payment_id = yookassa_payment_id
                existing.expires_at = expires_at

    await session.commit()


async def list_payment_history(
    session: AsyncSession, user_id: uuid.UUID
) -> list[PaymentHistory]:
    """Возвращает историю платежей пользователя."""
    result = await session.scalars(
        select(PaymentHistory)
        .where(PaymentHistory.user_id == user_id)
        .order_by(PaymentHistory.created_at.desc())
    )
    return list(result.all())