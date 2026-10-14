"""Бизнес-логика аналитики (Amplitude)."""

import asyncio
import uuid
from typing import Any, Coroutine

import httpx

from app.config import get_settings

settings = get_settings()

# Базовая URL Amplitude HTTP API v2.
AMPLITUDE_URL = "https://api2.amplitude.com/2/httpapi"

# Удерживаем ссылки на фоновые задачи, иначе сборщик мусора может
# уничтожить задачу до завершения (см. docs asyncio.create_task).
_background_tasks: set[asyncio.Task] = set()


def fire_and_forget(coro: Coroutine) -> None:
    """Запускает корутину аналитики в фоне, не блокируя вызывающий код.

    Ошибки внутри корутины проглатываются самими track-функциями,
    поэтому фоновая задача безопасна для основного потока запроса.
    """
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def track_event(
    user_id: uuid.UUID,
    event_type: str,
    event_properties: dict[str, Any] | None = None,
) -> bool:
    """Отправляет событие в Amplitude (fire-and-forget).

    Если Amplitude не настроен (нет ключа) — событие тихо пропускается
    (для локальной разработки и тестов).
    """
    api_key = settings.amplitude_api_key
    if not api_key:
        return False

    payload = {
        "api_key": api_key,
        "events": [
            {
                "user_id": str(user_id),
                "event_type": event_type,
                "event_properties": event_properties or {},
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                AMPLITUDE_URL,
                json=payload,
            )
            return resp.status_code == 200
    except httpx.HTTPError:
        # Не критично для MVP: аналитика не должна ломать основной поток.
        return False


async def track_mascot_petted(user_id: uuid.UUID) -> bool:
    """Отправляет событие поглаживания маскота."""
    return await track_event(
        user_id,
        "mascot_petted",
        {"source": "home_companion"},
    )


async def track_lex_entrance_hint_followed(
    user_id: uuid.UUID, case_id: str
) -> bool:
    """Отправляет событие следования подсказке LexEntrance."""
    return await track_event(
        user_id,
        "lex_entrance_hint_followed",
        {"case_id": case_id},
    )