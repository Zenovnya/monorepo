"""Pydantic-схемы модуля платежей."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SubscriptionCreateIn(BaseModel):
    """Запрос на создание подписки/платежа."""

    plan: str = Field(default="monthly", pattern="^(monthly|yearly)$")


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