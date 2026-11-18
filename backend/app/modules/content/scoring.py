"""Сверка ответа с эталоном для вопросов урока.

Единственное правило сравнения — здесь. Формат ``correct``:

- одиночный выбор — целое число (индекс правильного варианта);
- множественный выбор — список индексов;
- true/false — булево значение (True → 0, False → 1).

Нераспознанный формат даёт пустой список: такой вопрос считается невалидным
контентом и не засчитывается никому — молчаливое «верно» было бы хуже.
"""

from __future__ import annotations

from typing import Any

__all__ = ["ANSWER_FORMAT_ERROR", "is_answer_correct", "normalize_correct", "score_answers"]

ANSWER_FORMAT_ERROR = "ANSWER_FORMAT"


def normalize_correct(correct: Any) -> list[int]:
    """Приводит эталон к списку индексов."""
    if isinstance(correct, bool):
        return [0 if correct else 1]
    if isinstance(correct, int):
        return [correct]
    if isinstance(correct, (list, tuple)):
        return [int(v) for v in correct if _is_int(v)]
    return []


def _is_int(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    return isinstance(value, str) and value.lstrip("-").isdigit()


def normalize_answer(answer: Any) -> list[int]:
    """Приводит ответ пользователя к списку индексов.

    Формат повторяет клиентский контракт: число, список чисел или булево.
    """
    if answer is None:
        return []
    if isinstance(answer, bool):
        return [0 if answer else 1]
    if isinstance(answer, int):
        return [answer]
    if isinstance(answer, str):
        return [int(answer)] if _is_int(answer) else []
    if isinstance(answer, (list, tuple)):
        return [int(v) for v in answer if _is_int(v)]
    return []


def is_answer_correct(correct: Any, answer: Any) -> bool:
    """Совпадает ли ответ с эталоном (порядок для множественного не важен)."""
    expected = set(normalize_correct(correct))
    given = set(normalize_answer(answer))
    return bool(expected) and expected == given


def score_answers(questions: list[dict], answers: dict[str, Any]) -> tuple[int, int]:
    """Считает (верных, всего) по списку вопросов и ответам пользователя."""
    total = len(questions)
    correct = 0
    for question in questions:
        answer = answers.get(str(question.get("id")))
        if is_answer_correct(question.get("correct"), answer):
            correct += 1
    return correct, total
