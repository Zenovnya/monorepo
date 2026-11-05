"""Серверная проверка ответов на вопросы урока LexBear.

Единственное место, где ответ пользователя сравнивается с эталоном. Им
пользуется ``POST /lexbear/lessons/{id}/complete`` — клиент присылает сами
ответы, а не готовые «правильных N из M».

Формат ``Question.correct`` (см. ``lexbear_models.Question``):
- одиночный выбор — целое число (индекс правильного варианта);
- множественный выбор — список индексов;
- true/false — булево значение (True -> 0, False -> 1).

Формат ответа пользователя намеренно повторяет клиентский контракт: число,
список чисел или булево значение.
"""

from __future__ import annotations

from typing import Any


class AnswerFormatError(ValueError):
    """Ответ пользователя не соответствует формату вопроса."""


def normalize_correct(correct: Any) -> list[int]:
    """Приводит эталон ``Question.correct`` к списку индексов.

    Нераспознанный формат даёт пустой список: такой вопрос считается
    невалидным контентом и не засчитывается никому.
    """
    if isinstance(correct, bool):
        return [0 if correct else 1]
    if isinstance(correct, int):
        return [correct]
    if isinstance(correct, (list, tuple)):
        return [int(v) for v in correct if isinstance(v, (int, bool, str)) and _is_int(v)]
    return []


def _is_int(value: Any) -> bool:
    """True для значений, которые безопасно приводятся к int."""
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    if isinstance(value, str):
        return value.lstrip("-").isdigit()
    return False


def normalize_answer(answer: Any) -> list[int]:
    """Приводит ответ пользователя к отсортированному списку индексов.

    Пустой/отсутствующий ответ трактуется как «не ответил» — не ошибка
    формата, а просто неправильный ответ (пользователь мог пропустить вопрос).
    """
    if answer is None:
        return []
    if isinstance(answer, bool):
        return [0 if answer else 1]
    if isinstance(answer, int):
        return [answer]
    if isinstance(answer, str):
        if answer.lstrip("-").isdigit():
            return [int(answer)]
        raise AnswerFormatError(f"Некорректный ответ: {answer!r}")
    if isinstance(answer, (list, tuple)):
        values: list[int] = []
        for item in answer:
            if isinstance(item, bool) or not _is_int(item):
                raise AnswerFormatError(f"Некорректный ответ в списке: {item!r}")
            values.append(int(item))
        return values
    raise AnswerFormatError(f"Некорректный ответ: {answer!r}")


def is_answer_correct(correct: Any, answer: Any) -> bool:
    """Проверяет один ответ.

    Множественный выбор сравнивается как множество: порядок не важен,
    пропущенные и лишние варианты дают неверный ответ.
    """
    expected = sorted(normalize_correct(correct))
    if not expected:
        # Невалидный контент — не наказываем пользователя за чужую ошибку.
        return False
    return sorted(normalize_answer(answer)) == expected


def score_answers(
    questions: list[dict[str, Any]],
    answers: dict[str, Any] | dict[int, Any],
) -> tuple[int, int]:
    """Считает ``(correct, total)`` по ответам пользователя.

    ``questions`` — список с полями ``id`` и ``correct`` (как отдаёт
    ``get_lesson_detail``). ``answers`` — отображение ``id вопроса -> ответ``;
    ключи могут быть строками (так JSON приходит с клиента) или числами.

    ``total`` — число вопросов в уроке, а не число присланных ответов:
    пропущенные вопросы идут в знаменатель как неправильные, иначе клиент мог
    бы улучшить результат, просто не присылая сложные вопросы.
    """
    resolved: dict[int, Any] = {}
    for key, value in (answers or {}).items():
        try:
            resolved[int(key)] = value
        except (TypeError, ValueError):
            continue

    correct = 0
    for question in questions:
        question_id = question.get("id")
        if question_id is None:
            continue
        if question_id not in resolved:
            continue
        try:
            matched = is_answer_correct(
                question.get("correct"), resolved[question_id]
            )
        except AnswerFormatError:
            # Один битый ответ не должен ронять весь урок: он просто
            # не засчитывается, остальные проверяются как обычно.
            matched = False
        if matched:
            correct += 1
    return correct, len([q for q in questions if q.get("id") is not None])
