"""Pure tests for the deterministic adaptive-learning baseline."""

import pytest

from app.modules.learning.service import adaptive_score


def test_adaptive_score_prefers_weaker_competency() -> None:
    assert adaptive_score(0.9, 0.5) > adaptive_score(0.2, 0.5)


def test_adaptive_score_prefers_lower_difficulty_when_weakness_equal() -> None:
    assert adaptive_score(0.5, 0.2) > adaptive_score(0.5, 0.8)


def test_adaptive_score_is_bounded_for_normal_inputs() -> None:
    assert 0 <= adaptive_score(0, 1) <= 1
    assert 0 <= adaptive_score(1, 0) <= 1