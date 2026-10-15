"""Pure tests for adaptive-learning service helpers."""

import uuid

import pytest

from app.modules.learning.service import adaptive_score, new_competency_state


def test_new_competency_state_has_usable_numeric_defaults() -> None:
    """A new ORM state can be updated before it is flushed to the database."""
    state = new_competency_state(uuid.uuid4(), uuid.uuid4())

    state.attempts += 1
    state.correct_count += 1
    state.mastery += 0.12

    assert state.attempts == 1
    assert state.correct_count == 1
    assert state.mastery == pytest.approx(0.12)
    assert state.confidence == 0.0


def test_adaptive_score_prefers_weaker_competency() -> None:
    assert adaptive_score(0.9, 0.5) > adaptive_score(0.2, 0.5)


def test_adaptive_score_prefers_lower_difficulty_when_weakness_equal() -> None:
    assert adaptive_score(0.5, 0.2) > adaptive_score(0.5, 0.8)


def test_adaptive_score_is_bounded_for_normal_inputs() -> None:
    assert 0 <= adaptive_score(0, 1) <= 1
    assert 0 <= adaptive_score(1, 0) <= 1