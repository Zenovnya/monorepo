"""Проверки ввода админки: кейс и вопрос урока.

Эти схемы валидируют то, что редактор сохраняет руками. Правило одно и то же
для всех путей: **нерешаемый контент не должен сохраняться**. Кейс без
правильного варианта, кейс с двумя правильными, вопрос с `correct` вне списка
вариантов и вопрос с неизвестным `kind` («choise») выглядят безобидно в форме
и превращаются в задание, которое нельзя засчитать ни при каком ответе.

Записывать в БД здесь нечего: контент нового пака поставляется файлом
(``app/content_packs/themes.json``) и проверяется на импорте
(``app/modules/adaptive/pack.py``). Схемы остались потому, что админка
принимает правки и должна отвечать понятной ошибкой, а не 500.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

# Типы вопросов, формат `correct` у которых описан ниже.
QUESTION_KINDS = ("choice", "multi", "truefalse", "case")


class QuestionIn(BaseModel):
    """Вопрос/задание урока.

    ``correct`` — гибкое поле: индекс (int), список индексов или булево,
    в зависимости от ``kind`` (choice / multi / truefalse / case).
    """

    order: int = 0
    kind: str
    prompt: str
    case_text: str | None = None
    options: list[Any] = Field(default_factory=list)
    correct: Any = 0
    explanation: str = ""

    @field_validator("kind")
    @classmethod
    def _known_kind(cls, value: str) -> str:
        """Неизвестный тип вопроса не будет проверен ни одним путём.

        ``normalize_correct`` знает четыре формата ``correct``; опечатка в
        ``kind`` («choise») давала вопрос, который нельзя засчитать ни при
        каком ответе.
        """
        if value not in QUESTION_KINDS:
            raise ValueError(
                "Неизвестный тип вопроса. Допустимые: " + ", ".join(QUESTION_KINDS)
            )
        return value


class LessonIn(BaseModel):
    """Урок со вложенными вопросами."""

    slug: str = Field(min_length=1, max_length=96)
    title: str
    order: int = 0
    xp_reward: int = 10
    questions: list[QuestionIn] = Field(default_factory=list)

    @field_validator("questions")
    @classmethod
    def _correct_matches_options(cls, questions: list[QuestionIn]):
        """``correct`` обязан указывать внутрь списка вариантов.

        Раньше админка принимала вопрос с ``options: ["А","Б"], correct: 5`` —
        вопрос сохранялся, а верный ответ выбрать было невозможно. Отдельно
        проверяются вырожденные случаи множественного выбора (пустой список или
        все варианты сразу).
        """
        for index, question in enumerate(questions, start=1):
            count = len(question.options)
            if question.kind == "truefalse":
                # Формат true/false: ``correct`` — булево, вариантов нет.
                continue
            if count < 2:
                raise ValueError(f"Вопрос №{index}: нужно минимум два варианта ответа")
            indices = _correct_indices(question.correct)
            if not indices:
                raise ValueError(
                    f"Вопрос №{index}: не указан правильный вариант "
                    f"(correct={question.correct!r})"
                )
            outside = [i for i in indices if not 0 <= i < count]
            if outside:
                raise ValueError(
                    f"Вопрос №{index}: правильный вариант вне списка "
                    f"(correct={outside}, вариантов {count})"
                )
            if question.kind == "choice" and len(indices) != 1:
                raise ValueError(
                    f"Вопрос №{index}: для одиночного выбора нужен один индекс, "
                    f"получено {len(indices)}"
                )
            if question.kind == "multi" and len(set(indices)) == count:
                raise ValueError(
                    f"Вопрос №{index}: при множественном выборе все варианты "
                    "верны — такой вопрос не проверяет знание"
                )
        return questions


def _correct_indices(correct: Any) -> list[int]:
    """Индексы из поля ``correct`` (число, список или булево)."""
    if isinstance(correct, bool):
        return [0 if correct else 1]
    if isinstance(correct, int):
        return [correct]
    if isinstance(correct, (list, tuple)):
        result: list[int] = []
        for value in correct:
            if isinstance(value, bool):
                continue
            if isinstance(value, int):
                result.append(value)
            elif isinstance(value, str) and value.lstrip("-").isdigit():
                result.append(int(value))
        return result
    return []


class CaseOptionIn(BaseModel):
    """Вариант ответа кейса."""

    text: str
    is_correct: bool = False
    explanation: str | None = None


class CaseIn(BaseModel):
    """Кейс с вариантами ответов (ввод админки)."""

    slug: str = Field(min_length=1, max_length=96)
    title: str
    codex: str = Field(min_length=1, max_length=128)
    difficulty: str = "easy"
    case_text: str = Field(min_length=1)
    featured: bool = False
    hint: str | None = None
    options: list[CaseOptionIn] = Field(min_length=2)

    @field_validator("codex", "case_text", "title", mode="before")
    @classmethod
    def _strip_required(cls, value):
        """Обрезает пробелы и запрещает строки из одних пробелов."""
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                raise ValueError("Поле не может быть пустым")
            return stripped
        return value

    @field_validator("options")
    @classmethod
    def _exactly_one_correct(cls, options: list[CaseOptionIn]):
        """Ровно один правильный вариант — иначе кейс нерешаем.

        Кейс без правильного ответа и кейс с двумя правильными сохранялись с
        кодом 200: дальше пользователь получал задание, в котором верный ответ
        невозможно выбрать.
        """
        correct = sum(1 for option in options if option.is_correct)
        if correct != 1:
            raise ValueError(
                "У кейса должен быть ровно один правильный вариант "
                f"(сейчас отмечено {correct})"
            )
        return options
