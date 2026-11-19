"""Бизнес-логика платежей и подписок (ЮKassa)."""

import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.auth.models import User
from app.modules.payments.models import PaymentHistory, Subscription

logger = logging.getLogger(__name__)

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
    # order_id — наш внутренний идентификатор платежа; передаём его провайдеру
    # как номер заказа, чтобы затем сопоставить webhook.
    order_id = str(uuid.uuid4())
    description = f"{plan_cfg['type']}:{plan}"

    # Сохраняем запись о платеже (pending).
    session.add(
        PaymentHistory(
            user_id=user_id,
            yookassa_payment_id=order_id,
            amount=plan_cfg["amount_cents"],
            currency="RUB",
            status="pending",
            description=description,
        )
    )
    await session.commit()

    # Создаём оплату у активного провайдера (по умолчанию — заглушка).
    # Импорт локальный, чтобы избежать цикла и не тянуть провайдеров в тестах,
    # которые проверяют только бизнес-логику.
    from app.modules.payments.providers import get_payment_provider

    provider = get_payment_provider()

    # Ссылка возврата после оплаты. Раньше значение бралось из настройки,
    # которая по умолчанию пуста: пользователь после оплаты оставался на
    # странице шлюза без пути назад в приложение.
    return_url = (settings.payments_return_url or "").strip() or (
        f"{settings.app_base_url.rstrip('/')}/payment-return"
    )

    try:
        checkout = await provider.create_checkout(
            order_id=order_id,
            amount_cents=plan_cfg["amount_cents"],
            description=description,
            return_url=return_url,
        )
    except Exception as exc:  # noqa: BLE001 — шлюз может упасть по-разному
        # Провайдер не создал платёж (нет ключей, сеть, отказ шлюза). Запись
        # остаётся pending, но пользователь должен увидеть причину, а не 500:
        # деньги при этом не списаны, поэтому честнее сказать «оплата сейчас
        # недоступна», чем молча показать «оплачено».
        raise PaymentsError(
            "Платёжный шлюз недоступен — деньги не списаны. Попробуйте позже."
        ) from exc

    return {
        "payment_id": order_id,
        "confirmation_url": checkout.confirmation_url,
        "status": "pending",
        "checkout_configured": bool(provider.is_configured()),
    }


async def confirm_payment(
    session: AsyncSession,
    yookassa_payment_id: str,
    paid: bool = True,
    payment_method_id: str | None = None,
) -> None:
    """Подтверждает оплату из webhook ЮKassa.

    Для подписки — активирует/продлевает Premium.
    Для пакета гемов — начисляет гемы пользователю.

    ``payment_method_id`` — сохранённый шлюзом способ оплаты. Запоминаем его
    у подписки, чтобы при удалении аккаунта можно было отключить автосписания
    (у ЮKassa нет API удаления способа: достаточно перестать его использовать).
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
                        payment_method_id=payment_method_id,
                        expires_at=expires_at,
                    )
                )
            else:
                existing.status = "active"
                existing.plan = plan_key
                existing.yookassa_payment_id = yookassa_payment_id
                existing.expires_at = expires_at
                # Новый способ оплаты заменяет старый: автосписания пойдут по
                # нему, а прежний идентификатор больше не используется.
                if payment_method_id:
                    existing.payment_method_id = payment_method_id
                    existing.auto_renew = True

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

async def stop_autopayments(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> dict:
    """Отключает автосписания пользователя и отменяет незавершённые платежи.

    Вызывается при удалении аккаунта. Без этого автоплатёж продолжался бы:
    подписка хранит сохранённый шлюзом способ оплаты, а строка пользователя
    удаляется — деньги приходили бы на аккаунт, которого больше нет.

    Что делаем (порядок важен):

    1. Находим сохранённый способ оплаты — в подписке, а если её создали до
       появления колонки ``payment_method_id``, — спросив шлюз.
    2. Отменяем незавершённые платежи (``pending``): платёж, созданный за
       минуту до удаления, иначе может пройти уже после.
    3. Обнуляем ``payment_method_id`` и выключаем ``auto_renew``. Для ЮKassa
       этого достаточно: удаление способа оплаты на своей стороне и есть
       отключение автосписаний.

    Возвращает отчёт для ответа API и логов. Никогда не бросает: удаление
    аккаунта — требование магазинов и не должно падать из-за недоступности
    шлюза, но факт неудачи должен быть виден (``stopped: false``).
    """
    from app.modules.payments.providers import get_payment_provider

    report = {
        "stopped": False,
        "payment_methods": 0,
        "canceled_payments": 0,
    }

    subscription = await get_subscription(session, user_id)
    provider = get_payment_provider()

    methods: list[str] = []
    if subscription is not None and subscription.payment_method_id:
        methods.append(subscription.payment_method_id)

    # Подписка могла быть оформлена до миграции 0024 — тогда идентификатора
    # способа у нас нет. Спрашиваем шлюз (для заглушки список всегда пуст).
    list_methods = getattr(provider, "list_saved_payment_methods", None)
    if not methods and list_methods is not None:
        try:
            methods = await list_methods()
        except Exception as exc:  # noqa: BLE001 — шлюз не должен ронять удаление
            logger.warning("Не удалось получить способы оплаты: %s", exc)
            methods = []

    # Незавершённые платежи отменяем до того, как трогать подписку: после
    # отмены webhook может прийти со статусом canceled и не начислить ничего.
    pending = await session.scalars(
        select(PaymentHistory).where(
            PaymentHistory.user_id == user_id,
            PaymentHistory.status == "pending",
        )
    )
    for payment in list(pending.all()):
        try:
            canceled = await provider.cancel_payment(payment.yookassa_payment_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Отмена платежа %s не удалась: %s",
                payment.yookassa_payment_id,
                exc,
            )
            canceled = False
        if canceled:
            payment.status = "canceled"
            report["canceled_payments"] += 1

    if subscription is not None:
        subscription.auto_renew = False
        subscription.payment_method_id = None
        if subscription.status == "active":
            # Оплаченный доступ не отбираем задним числом, но и продлевать
            # больше нечего: статус фиксирует, что автоплатёж выключен.
            subscription.status = "canceled"
        report["stopped"] = True
        report["payment_methods"] = len(methods)

    await session.commit()
    return report
