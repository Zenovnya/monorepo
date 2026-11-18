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


class LessonIn(BaseModel):
    """Урок LexBear со вложенной теорией и вопросами."""

    slug: str = Field(min_length=1, max_length=96)
    title: str
    order: int = 0
    xp_reward: int = 10
    cards: list[TheoryCardIn] = Field(default_factory=list)
    questions: list[QuestionIn] = Field(default_factory=list)


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


class CasesPack(BaseModel):
    """Пак самостоятельных кейсов."""

    cases: list[CaseIn] = Field(default_factory=list)
