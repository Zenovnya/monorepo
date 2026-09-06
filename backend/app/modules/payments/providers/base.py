"""Абстракция платёжного провайдера.

Позволяет подключить любой платёжный шлюз (Робокасса, Продамус, ЮMoney,
CloudPayments, ЮKassa и т.д.) не меняя бизнес-логику подписок. Провайдер
решает ровно две задачи:

1. ``create_checkout`` — создать оплату у шлюза и вернуть URL, куда отправить
   пользователя (страница оплаты).
2. ``parse_webhook`` — проверить входящий webhook шлюза и вернуть, какой заказ
   и с каким исходом подтверждён.

Начисление Premium/гемов выполняет общий ``payments.service.confirm_payment`` —
он одинаков для всех провайдеров. Чтобы добавить реальный шлюз: наследуйте
``PaymentProvider``, реализуйте два метода и зарегистрируйте класс в
``providers/__init__.py``.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class CheckoutResult:
    """Результат создания оплаты у провайдера."""

    # URL страницы оплаты, куда отправляем пользователя.
    confirmation_url: str
    # Идентификатор платежа на стороне провайдера, если он его присваивает.
    # Если None — сопоставление идёт по нашему внутреннему order_id.
    provider_payment_id: str | None = None


@dataclass
class WebhookEvent:
    """Разобранное и проверенное событие webhook от платёжного шлюза."""

    # Идентификатор заказа/платежа, по которому ищем запись в БД
    # (наш order_id либо provider_payment_id).
    external_id: str
    # Успешно ли оплачено.
    paid: bool
    # Исходный распарсенный payload — для логов/расширений.
    raw: dict = field(default_factory=dict)


class WebhookError(Exception):
    """Webhook не прошёл проверку (неверная подпись или формат)."""


class WebhookNotConfigured(WebhookError):
    """Платёжный webhook не настроен (нет секрета) — приём запрещён."""


class PaymentProvider(ABC):
    """Базовый интерфейс платёжного провайдера."""

    # Короткое имя провайдера (совпадает с ключом в реестре).
    name: str = "base"

    @abstractmethod
    def is_configured(self) -> bool:
        """Готов ли провайдер принимать реальные платежи (заданы ключи)."""

    @abstractmethod
    async def create_checkout(
        self,
        *,
        order_id: str,
        amount_cents: int,
        description: str,
        return_url: str,
    ) -> CheckoutResult:
        """Создаёт оплату у шлюза и возвращает URL страницы оплаты.

        ``order_id`` — наш внутренний идентификатор платежа (uuid), который
        стоит передать шлюзу как номер заказа, чтобы затем сопоставить webhook.
        """

    @abstractmethod
    async def parse_webhook(
        self,
        *,
        body: bytes,
        headers,
    ) -> WebhookEvent:
        """Проверяет подпись webhook и возвращает событие.

        Должен бросать :class:`WebhookError` при неверной подписи/формате и
        :class:`WebhookNotConfigured`, если приём webhook не настроен.
        """
