"""Тесты серверной проверки ответов на вопросы урока.

Модуль чистый (без БД), поэтому работает всегда — включая окружения без
Postgres. Именно здесь фиксируется контракт: результат урока считает сервер,
а не клиент.
"""

import pytest

from app.modules.content.lexbear_scoring import (
    AnswerFormatError,
    is_answer_correct,
    normalize_answer,
    normalize_correct,
    score_answers,
)


# --- normalize_correct -------------------------------------------------------


def test_normalize_correct_single_choice():
    assert normalize_correct(2) == [2]


def test_normalize_correct_truefalse():
    # true -> 0, false -> 1 (порядок вариантов «Да», «Нет»).
    assert normalize_correct(True) == [0]
    assert normalize_correct(False) == [1]


def test_normalize_correct_multi_choice():
    assert normalize_correct([0, 2]) == [0, 2]


def test_normalize_correct_rejects_unknown_payload():
    assert normalize_correct(None) == []
    assert normalize_correct({"a": 1}) == []


# --- normalize_answer --------------------------------------------------------


def test_normalize_answer_accepts_json_string_keys():
    # Клиент присылает индексы числами, но JSON не гарантирует тип.
    assert normalize_answer("3") == [3]
    assert normalize_answer([1, "2"]) == [1, 2]


def test_normalize_answer_none_is_empty():
    assert normalize_answer(None) == []


def test_normalize_answer_rejects_garbage():
    with pytest.raises(AnswerFormatError):
        normalize_answer({"nested": True})
    with pytest.raises(AnswerFormatError):
        normalize_answer("не число")


# --- is_answer_correct -------------------------------------------------------


def test_single_choice_matches_exact_index():
    assert is_answer_correct(1, 1) is True
    assert is_answer_correct(1, 0) is False


def test_multi_choice_is_order_insensitive():
    assert is_answer_correct([0, 2], [2, 0]) is True


def test_multi_choice_rejects_partial_selection():
    # Из двух правильных выбран один — ответ неверный.
    assert is_answer_correct([0, 2], [0]) is False


def test_multi_choice_rejects_extra_selection():
    assert is_answer_correct([0, 2], [0, 1, 2]) is False


def test_unanswered_is_wrong_not_error():
    assert is_answer_correct(1, None) is False


def test_invalid_content_does_not_credit_user():
    # Пустой эталон — ошибка контента, а не повод начислить балл.
    assert is_answer_correct(None, 0) is False


# --- score_answers -----------------------------------------------------------


QUESTIONS = [
    {"id": 1, "correct": 1},
    {"id": 2, "correct": [0, 2]},
    {"id": 3, "correct": True},
]


def test_score_counts_all_correct():
    answers = {"1": 1, "2": [2, 0], "3": True}
    assert score_answers(QUESTIONS, answers) == (3, 3)


def test_score_counts_partial():
    answers = {"1": 1, "2": [0], "3": True}
    assert score_answers(QUESTIONS, answers) == (2, 3)


def test_missing_answers_count_in_denominator():
    """Пропущенные вопросы — в знаменателе, иначе клиент улучшил бы счёт."""
    assert score_answers(QUESTIONS, {"1": 1}) == (1, 3)


def test_no_answers_scores_zero_out_of_total():
    assert score_answers(QUESTIONS, {}) == (0, 3)


def test_score_ignores_unknown_question_ids():
    answers = {"1": 1, "999": 1}
    assert score_answers(QUESTIONS, answers) == (1, 3)


def test_score_accepts_integer_keys():
    assert score_answers(QUESTIONS, {1: 1, 2: [0, 2], 3: True}) == (3, 3)


def test_score_of_empty_lesson():
    assert score_answers([], {"1": 1}) == (0, 0)


def test_client_cannot_gain_by_sending_wrong_shape():
    """Мусор в ответах не должен приводить к начислению баллов."""
    assert score_answers(QUESTIONS, {"1": "abc"}) == (0, 3)
