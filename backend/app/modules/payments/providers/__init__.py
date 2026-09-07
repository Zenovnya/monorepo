"""Реестр платёжных провайдеров.

Активный провайдер выбирается по настройке ``PAYMENT_PROVIDER``. Пустое
значение → ``manual`` (заглушка). Чтобы подключить реальный шлюз:

1. Реализуйте :class:`PaymentProvider` в новом модуле (например ``robokassa.py``).
2. Зарегистрируйте класс в ``_PROVIDERS`` ниже.
3. Задайте ``PAYMENT_PROVIDER=robokassa`` и ключи шлюза в окружении.

Бизнес-логика подписок при этом не меняется.
"""

from functools import lru_cache

from app.config import get_settings
from app.modules.payments.providers.base import (
    CheckoutResult,
    PaymentProvider,
    WebhookError,
    WebhookEvent,
    WebhookNotConfigured,
)
from app.modules.payments.providers.manual import ManualProvider

__all__ = [
    "CheckoutResult",
    "PaymentProvider",
    "WebhookError",
    "WebhookEvent",
    "WebhookNotConfigured",
    "get_payment_provider",
]

# Ключ настройки PAYMENT_PROVIDER → класс провайдера.
# Раскомментируйте/добавьте строки по мере реализации реальных шлюзов.
_PROVIDERS: dict[str, type[PaymentProvider]] = {
    "": ManualProvider,
    "manual": ManualProvider,
    # "robokassa": RobokassaProvider,
    # "prodamus": ProdamusProvider,
    # "yoomoney": YooMoneyProvider,
    # "cloudpayments": CloudPaymentsProvider,
    # "yookassa": YooKassaProvider,
}


@lru_cache
def get_payment_provider() -> PaymentProvider:
    """Возвращает активный платёжный провайдер (кешируется).

    Неизвестное значение ``PAYMENT_PROVIDER`` безопасно откатывается на
    заглушку ``ManualProvider``.
    """
    settings = get_settings()
    key = (settings.payment_provider or "").strip().lower()
    provider_cls = _PROVIDERS.get(key, ManualProvider)
    return provider_cls()
