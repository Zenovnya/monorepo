"""Общие вспомогательные функции для backend."""

from datetime import datetime, timezone


def is_expired(expires_at: datetime | None, now: datetime | None = None) -> bool:
    """Проверяет, истёк ли срок у даты ``expires_at``.

    SQLite не сохраняет таймзону в DateTime, поэтому значения из БД могут
    приходить offset-naive, а ``datetime.now(timezone.utc)`` — aware.
    Сравнение aware и naive datetime бросает TypeError, поэтому приводим
    обе стороны к aware-UTC перед сравнением.
    """
    if expires_at is None:
        return False
    if now is None:
        now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return expires_at < now
