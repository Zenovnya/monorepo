"""Провайдер ЮKassa (``PAYMENT_PROVIDER=yookassa``).

Единственный реальный шлюз на сегодня. Реализует контракт
:class:`~app.modules.payments.providers.base.PaymentProvider`:

* ``create_checkout`` — ``POST /v3/payments`` с ``confirmation.type=redirect``
  и ``save_payment_method=true``, возвращает ``confirmation.confirmation_url``;
* ``parse_webhook`` — проверка подписи (если задан секрет) и разбор
  ``payment.succeeded`` / ``payment.canceled``;
* ``cancel_payment`` — ``POST /v3/payments/{id}/cancel``: отменяет платёж в
  статусе ``pending`` (например, созданный за минуту до удаления аккаунта);
* ``list_payment_methods`` — ``GET /v3/payments`` по сохранённым способам:
  нужен, чтобы при удалении аккаунта отключить автоплатежи, даже если подписка
  оформлена до появления колонки ``payment_method_id``.

Важно про отключение автосписаний. У ЮKassa **нет** API удаления сохранённого
способа оплаты: «удалить способ» = перестать использовать его идентификатор на
своей стороне (https://yookassa.ru/developers/payments/recurring-payments).
Поэтому отключение автоплатежа — это ``auto_renew = false`` и стирание
идентификатора в нашей базе; чужие способы оплаты и уже начатые платежи это не
затрагивает.

Сеть: как и ``app/email_service.py`` и ``app/push.py``, модуль не бросает
исключения наружу — платёж может не создаться из-за шлюза, но пользователь
должен получить понятный отказ, а не 500.
"""

from __future__ import annotations

import json
import logging
import uuid

import httpx

from app.config import get_settings
from app.modules.payments.providers.base import (
    CheckoutResult,
    PaymentProvider,
    WebhookError,
    WebhookEvent,
)

logger = logging.getLogger(__name__)

API_BASE = "https://api.yookassa.ru/v3"
TIMEOUT_SECONDS = 15.0

# Статусы платежа ЮKassa, означающие успешную оплату.
_PAID_STATUSES = {"succeeded"}


class YooKassaError(Exception):
    """Шлюз отказал в операции (сеть, 4xx/5xx, некорректный ответ)."""


class YooKassaProvider(PaymentProvider):
    """Реальный шлюз ЮKassa."""

    name = "yookassa"

    def __init__(self) -> None:
        settings = get_settings()
        self.shop_id = (settings.yookassa_shop_id or "").strip()
        self.secret_key = (settings.yookassa_secret_key or "").strip()
        self.webhook_secret = (
            settings.payments_webhook_secret or settings.yookassa_webhook_secret or ""
        ).strip()

    def is_configured(self) -> bool:
        return bool(self.shop_id and self.secret_key)

    def _auth(self) -> tuple[str, str]:
        return (self.shop_id, self.secret_key)

    async def _post(self, path: str, payload: dict) -> dict:
        if not self.is_configured():
            raise YooKassaError("ЮKassa не настроена: нет shop_id/secret_key")
        headers = {
            "Idempotence-Key": str(uuid.uuid4()),
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{API_BASE}{path}",
                auth=self._auth(),
                headers=headers,
                content=json.dumps(payload),
            )
        if response.status_code >= 400:
            raise YooKassaError(
                f"ЮKassa {path}: {response.status_code} {response.text[:200]}"
            )
        return response.json()

    async def create_checkout(
        self,
        *,
        order_id: str,
        amount_cents: int,
        description: str,
        return_url: str,
    ) -> CheckoutResult:
        from app.config import get_settings as _get_settings

        settings = _get_settings()
        if not self.is_configured():
            # Без ключей честно сообщаем наверх: клиент покажет
            # checkout_configured=false, а не откроет битую ссылку.
            raise YooKassaError("ЮKassa не настроена: нет shop_id/secret_key")

        payload = {
            "amount": {
                "value": f"{amount_cents / 100:.2f}",
                "currency": "RUB",
            },
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": return_url},
            "description": description[:128],
            "metadata": {"order_id": order_id},
            # Разрешаем сохранить способ оплаты: без этого автопродление
            # подписки технически невозможно.
            "save_payment_method": bool(settings.payments_save_payment_method),
        }
        data = await self._post("/payments", payload)

        confirmation = data.get("confirmation") or {}
        url = confirmation.get("confirmation_url") or ""
        if not url:
            raise YooKassaError("ЮKassa не вернула ссылку на оплату")
        return CheckoutResult(
            confirmation_url=url,
            provider_payment_id=data.get("id"),
        )

    async def cancel_payment(self, payment_id: str) -> bool:
        """Отменяет платёж в статусе ``pending``.

        Возвращает ``True``, если платёж отменён либо уже был в конечном
        статусе (отменять нечего). ``False`` — шлюз недоступен или отказал:
        вызывающая сторона должна сказать пользователю правду, а не делать
        вид, что автоплатёж отменён.
        """
        try:
            await self._post(f"/payments/{payment_id}/cancel", {})
            return True
        except YooKassaError as exc:
            message = str(exc)
            # 404/400 на cancel обычно означают «платёж уже завершён» —
            # деньги либо не списаны, либо возвращаются отдельным возвратом.
            if " 404 " in message or " 400 " in message:
                logger.info("ЮKassa: платёж %s уже нельзя отменить (%s)", payment_id, message)
                return True
            logger.warning("ЮKassa: не удалось отменить платёж %s: %s", payment_id, message)
            return False

    async def list_saved_payment_methods(self, limit: int = 20) -> list[str]:
        """Возвращает идентификаторы сохранённых способов оплаты магазина.

        У ЮKassa нет отдельного списка способов: сохранённые способы видны в
        платежах (``payment_method.saved = true``). Метод используется при
        удалении аккаунта, чтобы отключить автосписания даже для подписок,
        оформленных до появления ``subscriptions.payment_method_id``.
        """
        if not self.is_configured():
            return []
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                response = await client.get(
                    f"{API_BASE}/payments",
                    auth=self._auth(),
                    params={"limit": limit},
                )
            if response.status_code >= 400:
                logger.warning(
                    "ЮKassa: список платежей вернул %s", response.status_code
                )
                return []
            items = (response.json() or {}).get("items") or []
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("ЮKassa: список платежей недоступен: %s", exc)
            return []

        methods: list[str] = []
        for item in items:
            method = item.get("payment_method") or {}
            if method.get("saved") and method.get("id"):
                methods.append(str(method["id"]))
        return methods

    async def parse_webhook(self, *, body: bytes, headers) -> WebhookEvent:
        # ЮKassa шлёт уведомления либо с HTTP Basic (shop_id/secret), либо с
        # подписью, настроенной в личном кабинете. Подпись проверяем, только
        # если секрет задан: без него приём в production запрещён.
        if self.webhook_secret:
            import hashlib
            import hmac

            signature = ""
            if headers is not None:
                try:
                    signature = headers.get("x-signature", "") or headers.get(
                        "X-Signature", ""
                    )
                except AttributeError:
                    signature = ""
            expected = hmac.new(
                self.webhook_secret.encode("utf-8"), body, hashlib.sha256
            ).hexdigest()
            if not signature or not hmac.compare_digest(expected, signature):
                raise WebhookError("Неверная подпись webhook")

        try:
            payload = json.loads(body or b"{}")
        except (ValueError, TypeError) as exc:
            raise WebhookError("Некорректный JSON webhook") from exc
        if not isinstance(payload, dict):
            raise WebhookError("Некорректный формат webhook")

        event = str(payload.get("event") or "").lower()
        obj = payload.get("object")
        if not isinstance(obj, dict):
            raise WebhookError("В webhook нет объекта платежа")

        # Сопоставляем по нашему order_id из metadata — он стабилен, даже если
        # шлюз пересоздаст платёж. Резерв — id платежа шлюза.
        metadata = obj.get("metadata") or {}
        external_id = (
            metadata.get("order_id")
            or payload.get("order_id")
            or obj.get("id")
            or ""
        )
        if not external_id:
            raise WebhookError("Не удалось определить платёж из webhook")

        method = obj.get("payment_method") or {}
        paid = event == "payment.succeeded" or str(obj.get("status") or "") in _PAID_STATUSES

        return WebhookEvent(
            external_id=str(external_id),
            paid=paid,
            payment_method_id=(method.get("id") if method.get("saved") else None),
            saved=bool(method.get("saved")),
            raw=payload,
        )
