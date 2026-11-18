"""Отправка push-уведомлений через Expo Push API.

Токены устройств регистрировались и раньше (``push_tokens``), но кода,
который их использует, не было вообще: уведомления приходили только
локальные, запланированные на самом устройстве.

Единственная точка интеграции с Expo. Как и в ``email_service``, отсутствие
сети/ошибка провайдера не должны ронять бизнес-операцию: вызывающая сторона
получает отчёт, а не исключение.
"""

from __future__ import annotations

import logging
from typing import Iterable

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"
REQUEST_TIMEOUT_SECONDS = 10.0
# Expo принимает не больше 100 сообщений за запрос.
MAX_BATCH = 100


class PushResult:
    """Итог рассылки: сколько отправлено и какие токены стоит отключить."""

    def __init__(self) -> None:
        self.sent = 0
        self.failed = 0
        self.invalid_tokens: list[str] = []

    def as_dict(self) -> dict:
        return {
            "sent": self.sent,
            "failed": self.failed,
            "invalid_tokens": len(self.invalid_tokens),
        }


def _chunks(items: list, size: int) -> Iterable[list]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def build_message(
    *,
    token: str,
    title: str,
    body: str,
    data: dict | None = None,
    sound: str = "default",
) -> dict:
    """Формирует одно push-сообщение в формате Expo."""
    return {
        "to": token,
        "title": title,
        "body": body,
        "sound": sound,
        "data": data or {},
        "priority": "high",
        "channelId": "default",
    }


async def send_push_messages(messages: list[dict]) -> PushResult:
    """Отправляет пачку сообщений в Expo Push API.

    Никогда не бросает: сетевые ошибки логируются и попадают в ``failed``.
    Токены, на которые Expo ответил ``DeviceNotRegistered``, возвращаются
    в ``invalid_tokens`` — их надо погасить, иначе они копятся и waste-ят
    квоту (типичная причина «пуша не приходят»: часть токенов мертва).
    """
    result = PushResult()
    if not messages:
        return result

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        for batch in _chunks(messages, MAX_BATCH):
            try:
                response = await client.post(
                    EXPO_PUSH_ENDPOINT,
                    json=batch,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        # Expo не требует ключ для Expo Push Service, но
                        # рекомендует явный content-type и accept.
                    },
                )
                response.raise_for_status()
                payload = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Expo Push API недоступен: %s", exc)
                result.failed += len(batch)
                continue

            for index, ticket in enumerate(payload.get("data") or []):
                status = ticket.get("status")
                if status == "ok":
                    result.sent += 1
                    continue

                result.failed += 1
                details = ticket.get("details") or {}
                if details.get("error") == "DeviceNotRegistered":
                    token = batch[index].get("to")
                    if token:
                        result.invalid_tokens.append(token)

    return result


def messages_for_tokens(
    tokens: Iterable[object],
    *,
    title: str,
    body: str,
    data: dict | None = None,
) -> list[dict]:
    """Собирает сообщения для токенов.

    Принимает как строки, так и ORM-объекты ``PushToken`` (у них берётся
    ``.token``) — так транспорт не зависит от моделей и не создаёт циклов
    импорта с модулем уведомлений.
    """
    messages: list[dict] = []
    for item in tokens:
        value = item if isinstance(item, str) else getattr(item, "token", None)
        if not value:
            continue
        messages.append(
            build_message(token=value, title=title, body=body, data=data)
        )
    return messages
