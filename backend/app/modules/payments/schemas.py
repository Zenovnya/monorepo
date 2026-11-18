"""Pydantic-схемы модуля платежей."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SubscriptionCreateIn(BaseModel):
    """Запрос на создание платежа (подписка или пакет гемов)."""

    plan: str = Field(
        default="monthly",
        pattern="^(monthly|yearly|gems_500|gems_1200|gems_3000)$",
    )


class SubscriptionRead(BaseModel):
    """Подписка пользователя."""

    id: uuid.UUID
    status: str
    plan: str
    expires_at: datetime | None


class PaymentCreateOut(BaseModel):
    """Результат создания платежа ЮKassa."""

    payment_id: str
    confirmation_url: str
    status: str
    # Настроен ли реальный платёжный провайдер. При заглушке ссылка ведёт на
    # несуществующий checkout.invalid, и клиент должен честно об этом сказать,
    # а не открывать «мёртвый» адрес.
    checkout_configured: bool = True


class PaymentHistoryRead(BaseModel):
    """Запись истории платежей."""

    yookassa_payment_id: str
    amount: int
    currency: str
    status: str
    paid_at: datetime | None


class PremiumStatusRead(BaseModel):
    """Статус премиум-доступа."""

    is_premium: bool
    subscription: SubscriptionRead | None