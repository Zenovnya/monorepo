"""Общий rate limiter с распределённым состоянием в Redis.

Проблема прежних лимитеров: состояние хранилось в памяти процесса, поэтому при
нескольких uvicorn-воркерах каждый считал свой лимит (фактически лимит ×N), а
рестарт сбрасывал счётчики. Здесь состояние живёт в Redis и общее для всех
воркеров.

Отказоустойчивость: если Redis недоступен, лимитер прозрачно откатывается на
in-memory скользящее окно (поведение старого лимитера). Хуже, чем раньше, не
станет — в худшем случае лимит снова считается per-process.
"""

import time
from collections import defaultdict, deque

from app.cache import get_redis

# In-memory fallback: {namespace: {identifier: deque[timestamps]}}
_mem: dict[str, dict[str, deque]] = defaultdict(lambda: defaultdict(deque))
_mem_calls = 0


def _mem_check(
    namespace: str,
    identifier: str,
    max_requests: int,
    window_seconds: int,
) -> bool:
    """Скользящее окно в памяти процесса (fallback при недоступном Redis)."""
    global _mem_calls
    now = time.monotonic()

    # Периодическая чистка устаревших идентификаторов (защита от утечки памяти).
    _mem_calls += 1
    if _mem_calls % 1000 == 0:
        bucket = _mem[namespace]
        stale = [
            ident
            for ident, q in bucket.items()
            if not q or now - q[-1] > window_seconds
        ]
        for ident in stale:
            del bucket[ident]

    queue = _mem[namespace][identifier]
    while queue and now - queue[0] > window_seconds:
        queue.popleft()

    if len(queue) >= max_requests:
        return False
    queue.append(now)
    return True


async def check_rate_limit(
    namespace: str,
    identifier: str,
    max_requests: int,
    window_seconds: int,
) -> bool:
    """Возвращает True, если запрос разрешён, и False при превышении лимита.

    Сначала пытается использовать Redis (фиксированное окно, общее для всех
    воркеров). При любой ошибке Redis — откат на in-memory скользящее окно.
    """
    key = f"rl:{namespace}:{identifier}"
    try:
        redis = get_redis()
        current = await redis.incr(key)
        if current == 1:
            # Первый запрос в окне — задаём срок жизни счётчика.
            await redis.expire(key, window_seconds)
        return current <= max_requests
    except Exception:
        # Redis недоступен — используем локальный fallback.
        return _mem_check(namespace, identifier, max_requests, window_seconds)
