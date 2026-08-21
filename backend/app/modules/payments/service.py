"""Бизнес-логика платежей и подписок (ЮKassa)."""

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.auth.models import User
from app.modules.payments.models import PaymentHistory, Subscription

settings = get_settings()

# Цены в копейках.
PLANS = {
    "monthly": {"amount_cents": 39900, "days": 30},
    "yearly": {"amount_cents": 299000, "days": 365},
}


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
    """Создаёт платёж в ЮKassa и сохраняет запись истории."""
    if plan not in PLANS:
        raise PlanNotFoundError(f"Тариф не найден: {plan}")

    plan_cfg = PLANS[plan]
    payment_id = str(uuid.uuid4())

    # Сохраняем запись о платеже (pending).
    session.add(
        PaymentHistory(
            user_id=user_id,
            yookassa_payment_id=payment_id,
            amount=plan_cfg["amount_cents"],
            currency="RUB",
            status="pending",
            description=f"Подписка LexBear Plus ({plan})",
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
    """Подтверждает оплату из webhook ЮKassa и активирует подписку."""
    history = await session.scalar(
        select(PaymentHistory).where(
            PaymentHistory.yookassa_payment_id == yookassa_payment_id
        )
    )
    if history is None:
        raise SubscriptionNotFoundError("Платёж не найден")

    history.status = "succeeded" if paid else "canceled"
    if paid:
        history.paid_at = datetime.now(timezone.utc)

        # Определяем план по описанию (для MVP).
        plan = "monthly"
        if history.description and "yearly" in history.description:
            plan = "yearly"
        plan_cfg = PLANS.get(plan, PLANS["monthly"])

        # Активируем/обновляем подписку пользователя.
        user_id = history.user_id
        expires_at = datetime.now(timezone.utc) + timedelta(days=plan_cfg["days"])

        existing = await get_subscription(session, user_id)
        if existing is None:
            session.add(
                Subscription(
                    user_id=user_id,
                    status="active",
                    plan=plan,
                    yookassa_payment_id=yookassa_payment_id,
                    expires_at=expires_at,
                )
            )
        else:
            existing.status = "active"
            existing.plan = plan
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