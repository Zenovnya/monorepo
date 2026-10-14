"""Pydantic-схемы модуля контента."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CaseOptionRead(BaseModel):
    """Вариант ответа кейса (без маркера правильности)."""

    id: int
    text: str

    model_config = ConfigDict(from_attributes=True)


class CaseRead(BaseModel):
    """Кейс урока с полями Lex."""

    id: uuid.UUID
    situation: str
    case_type: str
    lex_entrance_type: str | None
    lex_hint_text: str | None
    lex_hint_option_id: int | None
    scene_background: str | None
    scene_config: dict | None
    sort_order: int
    options: list[CaseOptionRead]

    model_config = ConfigDict(from_attributes=True)


class LessonRead(BaseModel):
    """Урок ветки."""

    id: uuid.UUID
    branch_id: uuid.UUID
    title: str
    content: str | None
    sort_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BranchRead(BaseModel):
    """Ветка обучения."""

    id: uuid.UUID
    title: str
    description: str | None
    icon: str | None
    is_premium: bool
    sort_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)