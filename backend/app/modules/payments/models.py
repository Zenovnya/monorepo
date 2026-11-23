"""ORM-модели модуля платежей и подписок."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Subscription(Base):
    """Подписка пользователя на премиум-доступ.

    ``status``: active / canceled / expired / trial.
    ``plan``: monthly / yearly.
    """

    __tablename__ = "subscriptions"

    def __init__(self, **kwargs) -> None:
        """Проставляет автопродление сразу, не дожидаясь flush.

        ``default=`` в SQLAlchemy применяется при вставке, поэтому свежая
        подписка имела ``auto_renew = None``, а проверки вида
        ``if subscription.auto_renew`` считали бы её выключенной. Та же ловушка
        уже была в ``NotificationSettings``, поэтому дублируем на уровне модели.
        """
        kwargs.setdefault("auto_renew", True)
        super().__init__(**kwargs)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), default="trial", nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(32), default="monthly", nullable=False)
    # Внешний идентификатор платежа в ЮKassa.
    yookassa_payment_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Сохранённый шлюзом способ оплаты (ЮKassa: payment_method.id). Пока он
    # есть и auto_renew включён, магазин может списать деньги без участия
    # пользователя. У ЮKassa нет API удаления способа оплаты: отключение
    # автосписаний — это удаление идентификатора у себя, поэтому колонка
    # обнуляется при отмене подписки и при удалении аккаунта.
    payment_method_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Разрешены ли автосписания. Пользователь может отключить продление, не
    # теряя оплаченный доступ до expires_at.
    auto_renew: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )


class PaymentHistory(Base):
    """История платежей пользователя (ЮKassa)."""

    __tablename__ = "payment_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    yookassa_payment_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # в копейках
    currency: Mapped[str] = mapped_column(String(8), default="RUB", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
        index=True,
    )