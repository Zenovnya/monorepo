"""Pydantic-схемы валидации контент-паков (JSON) и админ-CRUD.

Схемы гарантируют, что перед записью в БД данные корректны: отсутствующее
обязательное поле или неверный тип дадут понятную ошибку валидации, а не
частично записанный контент.
"""

from typing import Any

from pydantic import BaseModel, Field, field_validator


class TheoryCardIn(BaseModel):
    """Карточка теории."""

    order: int = 0
    title: str
    definition: str
    practical: str = ""
    chips: list[str] = Field(default_factory=list)
    bear_line: str = ""


# Типы вопросов, формат `correct` у которых описан в lexbear_scoring.
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

        `lexbear_scoring` знает четыре формата `correct`; опечатка в `kind`
        («choise») давала вопрос, который нельзя засчитать ни при каком ответе.
        """
        if value not in QUESTION_KINDS:
            raise ValueError(
                "Неизвестный тип вопроса. Допустимые: " + ", ".join(QUESTION_KINDS)
            )
        return value


class LessonIn(BaseModel):
    """Урок LexBear со вложенной теорией и вопросами."""

    slug: str = Field(min_length=1, max_length=96)
    title: str
    order: int = 0
    xp_reward: int = 10
    cards: list[TheoryCardIn] = Field(default_factory=list)
    questions: list[QuestionIn] = Field(default_factory=list)

    @field_validator("questions")
    @classmethod
    def _correct_matches_options(cls, questions: list[QuestionIn]):
        """`correct` обязан указывать внутрь списка вариантов.

        Раньше `PUT /admin/content/units/{unit}/lessons` принимал вопрос с
        `options: ["А","Б"], correct: 5` — вопрос сохранялся, а верный ответ
        выбрать было невозможно. Отдельно проверяются вырожденные случаи
        множественного выбора (пустой список или все варианты сразу).
        """
        for index, question in enumerate(questions, start=1):
            count = len(question.options)
            if question.kind == "truefalse":
                # Формат true/false: `correct` — булево, вариантов нет.
                continue
            if count < 2:
                raise ValueError(
                    f"Вопрос №{index}: нужно минимум два варианта ответа"
                )
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
    """Индексы из поля `correct` (число, список или булево)."""
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


class UnitIn(BaseModel):
    """Юнит/остров обучения со вложенными уроками."""

    code: str = Field(min_length=1, max_length=64)
    codex: str
    title: str
    subtitle: str = ""
    order: int = 0
    color: str = "#C9A227"
    locked: bool = False
    why_practical: str = ""
    # False — юнит остаётся в паках, но не отдаётся клиенту и деактивируется в БД
    # (мягкое удаление: прогресс и FK сохраняются).
    is_active: bool = True
    lessons: list[LessonIn] = Field(default_factory=list)


class CurriculumPack(BaseModel):
    """Пак учебного плана: юниты → уроки → теория/вопросы."""

    units: list[UnitIn] = Field(default_factory=list)


class ArticleIn(BaseModel):
    """Справочная статья кодекса."""

    code: str = Field(min_length=1, max_length=64)
    codex: str
    number: str
    title: str
    plain: str
    full: str


class ArticlesPack(BaseModel):
    """Пак справочных статей."""

    articles: list[ArticleIn] = Field(default_factory=list)


class CaseOptionIn(BaseModel):
    """Вариант ответа кейса."""

    text: str
    is_correct: bool = False
    explanation: str | None = None


class CaseIn(BaseModel):
    """Кейс вкладки «Кейсы» с вариантами ответов."""

    slug: str = Field(min_length=1, max_length=96)
    title: str
    # min_length=1: пустой кодекс проходил схему, и такой кейс молча исчезал
    # из GET /lexbear/cases (там пустой codex отфильтровывается) — кейс
    # сохранялся в админке, но до пользователя не доходил.
    codex: str = Field(min_length=1, max_length=128)
    difficulty: str = "easy"
    case_text: str = Field(min_length=1)
    featured: bool = False
    # Опциональная подсказка для кнопки «Подсказка» на экране кейса —
    # ссылка на статью/закон, не раскрывающая правильный ответ.
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

        Импорт из JSON-паков это проверяет (`importer.validate_case`), а
        админка — нет: кейс без правильного ответа и кейс с двумя правильными
        сохранялись с кодом 200. Дальше он попадал в адаптивный банк и в
        диагностику, где `evaluate` не мог выставить вердикт, а пользователь
        получал XP за ответ, который невозможно выбрать правильно.
        """
        correct = sum(1 for option in options if option.is_correct)
        if correct != 1:
            raise ValueError(
                "У кейса должен быть ровно один правильный вариант "
                f"(сейчас отмечено {correct})"
            )
        return options


class CasesPack(BaseModel):
    """Пак самостоятельных кейсов."""

    cases: list[CaseIn] = Field(default_factory=list)
