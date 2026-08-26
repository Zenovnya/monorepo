"""Клиент кэша на основе Redis.

Используется для кэширования горячих данных (профиль, геймификация, контент).
Настройка адреса через переменную окружения REDIS_URL (по умолчанию redis://localhost:6379).
"""

import os
from typing import Optional

import redis.asyncio as aioredis

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

_client: Optional[aioredis.Redis] = None


def get_redis() -> aioredis.Redis:
    """Возвращает асинхронный клиент Redis (lazy-инициализация).

    Клиент создаётся один раз и переиспользуется. Подключение
    устанавливается лениво при первом запросе.
    """
    global _client
    if _client is None:
        _client = aioredis.from_url(
            _REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _client


async def close_redis() -> None:
    """Закрывает соединение Redis (для тестов и graceful shutdown)."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def cache_get(key: str) -> Optional[str]:
    """Возвращает значение из кэша или None."""
    try:
        return await get_redis().get(key)
    except Exception:
        # Кэш не критичен — при сбое Redis отдаём None.
        return None


async def cache_set(key: str, value: str, ttl: int = 300) -> None:
    """Сохраняет значение в кэш с TTL (в секундах)."""
    try:
        await get_redis().set(key, value, ex=ttl)
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    """Удаляет значение из кэша."""
    try:
        await get_redis().delete(key)
    except Exception:
        pass