"""Юнит-тесты алгоритма SRS SM-2."""

import pytest

from app.modules.srs.sm2 import MIN_EASE_FACTOR, sm2


def test_correct_first_repetition_interval_1() -> None:
    result = sm2(quality=5)
    assert result.repetitions == 1
    assert result.interval_days == 1
    assert result.ease_factor > 2.5


def test_correct_second_repetition_interval_6() -> None:
    result = sm2(quality=5, repetitions=1, interval_days=1)
    assert result.repetitions == 2
    assert result.interval_days == 6


def test_correct_third_repetition_uses_ease() -> None:
    # После двух успехов интервал умножается на ease_factor.
    result = sm2(
        quality=5,
        repetitions=2,
        interval_days=6,
        ease_factor=2.5,
    )
    assert result.repetitions == 3
    assert result.interval_days == round(6 * 2.5)  # 15


def test_wrong_answer_resets_repetitions() -> None:
    result = sm2(quality=1, repetitions=5, interval_days=30, ease_factor=2.5)
    assert result.repetitions == 0
    assert result.interval_days == 1


def test_ease_factor_never_below_minimum() -> None:
    result = sm2(quality=3, repetitions=1, interval_days=1, ease_factor=1.3)
    assert result.ease_factor >= MIN_EASE_FACTOR


def test_invalid_quality_raises() -> None:
    with pytest.raises(ValueError):
        sm2(quality=6)
    with pytest.raises(ValueError):
        sm2(quality=-1)

def test_review_state_defaults_are_numeric_before_flush() -> None:
    """Новое состояние SRS не содержит None в счётчиках.

    Регрессия: `default=` на колонке применяется только при INSERT, поэтому
    свежий `ReviewState` до flush имел repetitions=None, и SM-2 падал с
    TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'.
    Это был самый первый ответ на кейс у нового пользователя — то есть
    разбор любого дела отдавал 500 сразу после регистрации.
    """
    import uuid
    from datetime import datetime, timezone

    from app.modules.progress.models import ReviewState

    state = ReviewState(
        user_id=uuid.uuid4(),
        case_id=uuid.uuid4(),
        due_at=datetime.now(timezone.utc),
    )

    assert state.repetitions == 0
    assert state.interval_days == 0
    assert state.ease_factor == 2.5


def test_first_answer_on_fresh_state_does_not_raise() -> None:
    """SM-2 принимает свежее состояние: первый ответ не падает."""
    from app.modules.srs.sm2 import sm2

    result = sm2(5, repetitions=0, interval_days=0, ease_factor=2.5)

    assert result.repetitions == 1
    assert result.interval_days == 1
