"""Контракты API адаптивного обучения.

Схемы отдельные от домена: ответ движка содержит то, что нужно серверу
(``matched_error_tag``, служебные коды), а клиенту — только то, что он
показывает. Смешивать их значит рано или поздно отдать лишнее.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TopicRead(BaseModel):
    topic_id: str
    title: str
    order: int
    lessons_total: int


class MetadataRead(BaseModel):
    release_key: str
    editorial_note: str | None = None
    topics: list[TopicRead]


class OptionRead(BaseModel):
    id: str
    text: str


class ItemRead(BaseModel):
    """Карточка до ответа: без ключа, разбора и ссылок на нормы."""

    item_id: str
    kind: str
    topic_id: str
    topic_title: str
    lesson_id: str
    lesson_title: str
    subtopic_id: str
    situation: str
    question: str
    options: list[OptionRead]


class ChoiceRead(BaseModel):
    kind: str
    reason: str
    topic_id: str | None = None
    item_id: str | None = None
    lesson_id: str | None = None
    attempt_id: str | None = None
    origin: str | None = None


class LessonRead(BaseModel):
    lesson_id: str
    title: str
    order: int
    goal: str
    theory: str
    actions: list
    topic_id: str
    topic_title: str
    subtopic_id: str
    legal_basis_ids: list[str]
    sources: list = Field(default_factory=list)
    guide_item_id: str
    control_item_id: str
    content_version: int = 1
    legal_review_status: str
    open_attempt_id: str | None = None


class NextRead(BaseModel):
    choice: ChoiceRead
    item: ItemRead | None = None
    preview: ItemRead | None = None
    lesson: LessonRead | None = None
    attempt_id: str | None = None
    mode: str | None = None
    origin: str | None = None


class OpenRequest(BaseModel):
    item_id: str
    mode: str = "practice"
    # ``auto`` клиенту недоступен: выдачу с зачётом открывает только /next.
    origin: str = "manual"


class AttemptOpenRead(BaseModel):
    attempt_id: str
    mode: str
    origin: str
    item: ItemRead


class ActionRequest(BaseModel):
    action: str = "answer"
    option_id: str | None = None


class ActionResultRead(BaseModel):
    attempt_id: str
    status: str
    reason: str | None = None
    counted: bool = False
    already_closed: bool = False
    correct: bool | None = None
    correct_option_id: str | None = None
    explanation: str | None = None
    options: list[dict] | None = None
    legal_basis_ids: list[str] | None = None
    assistance: str | None = None
    xp_gained: int = 0


class LessonProgressRead(BaseModel):
    lesson_id: str
    title: str
    order: int
    goal: str
    practised: bool


class TopicProgressRead(BaseModel):
    topic_id: str
    title: str
    order: int
    summary: str | None = None
    # Короткий акцент темы («Гарантии и границы»). Нужен интерфейсу: карточка
    # темы показывает одну строку вместо summary в три строки — иначе список
    # тем превращается в текст, который никто не читает.
    focus: str | None = None
    weight_pct: int
    n: int
    errors: int
    correct_count: int
    practice_priority: float
    progress_pct: float
    priority: float
    state: str
    lessons_total: int
    lessons_practised: int
    lessons: list[LessonProgressRead]


class ObservationRead(BaseModel):
    seq: int
    topic_id: str
    item_id: str
    correct: bool
    voided: bool


class OverviewRead(BaseModel):
    release_key: str
    editorial_note: str | None = None
    open_attempt_id: str | None = None
    topics: list[TopicProgressRead]
    recent: list[ObservationRead]
