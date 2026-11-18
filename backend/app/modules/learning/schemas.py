import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnswerRead(BaseModel):
    id: uuid.UUID
    text: str


class CaseRead(BaseModel):
    case_version_id: uuid.UUID
    step_id: uuid.UUID
    situation: str
    prompt: str
    answers: list[AnswerRead]
    difficulty: float


class AttemptCreate(BaseModel):
    case_version_id: uuid.UUID
    step_id: uuid.UUID
    answer_id: uuid.UUID
    time_spent_seconds: int = Field(default=0, ge=0, le=3600)
    hints_used: int = Field(default=0, ge=0, le=20)
    assessment_session_id: uuid.UUID | None = None


class AttemptResult(BaseModel):
    attempt_id: uuid.UUID
    correct: bool
    error_type: str | None
    explanation: str | None
    mastery_updates: dict[uuid.UUID, float]


class AssessmentStart(BaseModel):
    session_id: uuid.UUID
    case: CaseRead | None
    # Причина пустой выдачи: ``no_content`` — в банке нет опубликованных
    # кейсов, ``awaiting_review`` — они есть, но ни один не прошёл юридическую
    # проверку. ``None`` — кейс есть. Без этого клиент не может отличить
    # «проверять нечего» от «всё пройдено» и от сбоя загрузки.
    unavailable_reason: str | None = None


class CompetencyProgress(BaseModel):
    competency_id: uuid.UUID
    mastery: float
    confidence: float
    attempts: int
    correct_count: int
    next_review: datetime | None

    model_config = ConfigDict(from_attributes=True)