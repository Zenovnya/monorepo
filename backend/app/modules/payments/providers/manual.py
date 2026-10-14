"""Провайдер по умолчанию — «ручной» / заглушка.

Используется, пока не подключён реальный платёжный шлюз. Он:

- ``create_checkout`` — возвращает URL-заглушку на основе ``order_id``.
  Реальной оплаты не происходит: приложение и тесты работают, деньги не
  списываются. Реальный провайдер здесь сделает запрос к API шлюза и вернёт
  настоящую страницу оплаты.
- ``parse_webhook`` — универсальная проверка HMAC-SHA256 подписи тела запроса
  по секрету ``PAYMENTS_WEBHOOK_SECRET`` (заголовок ``X-Signature``). Без
  секрета: в ``debug`` webhook принимается (для локальных тестов), в
  production — запрещён (:class:`WebhookNotConfigured`).

Формат webhook сознательно универсальный: ``order_id`` берётся из нескольких
типичных полей, а статус — из ``status``/``event``. Реальный провайдер обычно
переопределяет ``parse_webhook`` под формат конкретного шлюза.
"""

import hashlib
import hmac
import json

from app.config import get_settings
from app.modules.payments.providers.base import (
    CheckoutResult,
    PaymentProvider,
    WebhookError,
    WebhookEvent,
    WebhookNotConfigured,
)

settings = get_settings()

# Статусы разных шлюзов, означающие успешную оплату.
_PAID_STATUSES = {"succeeded", "payment.succeeded", "paid", "success", "completed"}


class ManualProvider(PaymentProvider):
    """Заглушка: реальных денег не принимает, но весь поток работает без сбоев."""

    name = "manual"

    def is_configured(self) -> bool:
        # Заглушка формально «готова», но реальную оплату не проводит.
        # Реальный провайдер вернёт True только при заданных ключах.
        return False

    async def create_checkout(
        self,
        *,
        order_id: str,
        amount_cents: int,
        description: str,
        return_url: str,
    ) -> CheckoutResult:
        # Плейсхолдер: настоящий шлюз вернёт здесь свою страницу оплаты.
        # Оставляем очевидно-нерабочий URL, чтобы placeholder не приняли за
        # реальную оплату.
        url = f"https://checkout.invalid/pay/{order_id}"
        return CheckoutResult(confirmation_url=url, provider_payment_id=None)

    async def parse_webhook(self, *, body: bytes, headers) -> WebhookEvent:
        secret = (
            settings.payments_webhook_secret or settings.yookassa_webhook_secret
        )
        if not secret:
            if not settings.debug:
                raise WebhookNotConfigured("Платёжный webhook не настроен")
            # debug без секрета — принимаем без проверки подписи (локальные тесты)
        else:
            signature = ""
            if headers is not None:
                # Starlette Headers регистронезависимы; обычный dict — нет.
                try:
                    signature = headers.get("x-signature", "") or headers.get(
                        "X-Signature", ""
                    )
                except AttributeError:
                    signature = ""
            expected = hmac.new(
                secret.encode("utf-8"), body, hashlib.sha256
            ).hexdigest()
            if not signature or not hmac.compare_digest(expected, signature):
                raise WebhookError("Неверная подпись webhook")

        try:
            payload = json.loads(body or b"{}")
        except (ValueError, TypeError) as exc:
            raise WebhookError("Некорректный JSON webhook") from exc

        if not isinstance(payload, dict):
            raise WebhookError("Некорректный формат webhook")

        obj = payload.get("object")
        external_id = (
            payload.get("order_id")
            or payload.get("payment_id")
            or (obj.get("id") if isinstance(obj, dict) else None)
            or ""
        )
        status = str(payload.get("status") or payload.get("event") or "").lower()
        paid = status in _PAID_STATUSES
        return WebhookEvent(external_id=str(external_id), paid=paid, raw=payload)
