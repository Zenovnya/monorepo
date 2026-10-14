"""Юнит-тесты модуля аналитики."""

import uuid

from app.modules.analytics import service


async def test_track_event_without_key_returns_false() -> None:
    # Если Amplitude не настроен — событие пропускается без ошибки.
    result = await service.track_event(uuid.uuid4(), "test_event")
    assert result is False


async def test_track_mascot_petted_without_key() -> None:
    result = await service.track_mascot_petted(uuid.uuid4())
    assert result is False


async def test_track_lex_entrance_hint_followed_without_key() -> None:
    result = await service.track_lex_entrance_hint_followed(uuid.uuid4(), "case-1")
    assert result is False