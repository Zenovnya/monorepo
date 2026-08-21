"""Pydantic-схемы модуля прогресса."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProgressItemRead(BaseModel):
    """Прогресс по одному уроку."""

    lesson_id: uuid.UUID
    completed: bool
    best_score: int
    attempts: int
    crowns: int


class ProgressOverviewRead(BaseModel):
    """Сводка по прогрессу пользователя."""

    items: list[ProgressItemRead]
    total_completed: int
    total_crowns: int


class ProgressAnswerIn(BaseModel):
    """Ответ на кейс урока (для подсчёта и SRS)."""

    case_id: uuid.UUID
    option_id: int
    # Оценка качества ответа для SM-2 (0..5).
    # Если не указана, вычисляется по правильности (5 или 1).
    quality: int | None = Field(default=None, ge=0, le=5)


class ProgressCompleteIn(BaseModel):
    """Завершение урока."""

    lesson_id: uuid.UUID
    score: int = Field(ge=0, le=100)


class ProgressAnswerOut(BaseModel):
    """Результат ответа на кейс."""

    correct: bool
    is_correct: bool
    explanation: str | None
    sm2: dict | None = None


class ProgressCompleteOut(BaseModel):
    """Результат завершения урока."""

    completed: bool
    best_score: int
    attempts: int
    crowns: int