"""Бизнес-логика модуля прогресса."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import Case, CaseOption, Lesson
from app.modules.progress.models import Progress, ReviewLog, ReviewState


class ProgressError(Exception):
    """Базовое исключение модуля прогресса."""


class LessonNotFoundError(ProgressError):
    """Урок не найден."""


class CaseNotFoundError(ProgressError):
    """Кейс не найден."""


class OptionNotFoundError(ProgressError):
    """Вариант ответа не найден."""


async def get_progress(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[Progress]:
    """Возвращает прогресс пользователя по всем урокам."""
    result = await session.scalars(
        select(Progress).where(Progress.user_id == user_id)
    )
    return list(result.all())


async def get_reviews_for_user(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[dict]:
    """Возвращает список кейсов, подлежащих повторению (due_at <= now).

    Кейсы упорядочены по дате повторения: сначала самые просроченные.
    """
    now = datetime.now(timezone.utc)
    result = await session.scalars(
        select(ReviewState)
        .where(
            ReviewState.user_id == user_id,
            ReviewState.due_at <= now,
        )
        .order_by(ReviewState.due_at)
    )
    states = list(result.all())

    reviews = []
    for state in states:
        case = await session.get(Case, state.case_id)
        if case is None:
            continue
        reviews.append(
            {
                "case_id": str(state.case_id),
                "due_at": state.due_at.isoformat(),
                "interval_days": state.interval_days,
                "ease_factor": round(state.ease_factor, 2),
                "situation": case.situation,
            }
        )
    return reviews


async def _get_or_create_progress(
    session: AsyncSession,
    user_id: uuid.UUID,
    lesson_id: uuid.UUID,
) -> Progress:
    """Возвращает прогресс по уроку, создавая при необходимости."""
    progress = await session.scalar(
        select(Progress).where(
            Progress.user_id == user_id,
            Progress.lesson_id == lesson_id,
        )
    )
    if progress is None:
        progress = Progress(
            user_id=user_id,
            lesson_id=lesson_id,
        )
        session.add(progress)
    return progress


async def answer_case(
    session: AsyncSession,
    user_id: uuid.UUID,
    case_id: uuid.UUID,
    option_id: int,
    quality: int | None = None,
) -> dict:
    """Обрабатывает ответ на кейс: проверяет правильность и обновляет SRS."""
    # Ленивый импорт SM-2: разрывает циклический импорт
    # (srs/__init__ -> srs.routes -> progress.service).
    from app.modules.srs.sm2 import sm2

    case = await session.get(Case, case_id)
    if case is None:
        raise CaseNotFoundError("Кейс не найден")

    option = await session.get(CaseOption, option_id)
    if option is None:
        raise OptionNotFoundError("Вариант ответа не найден")

    correct = option.is_correct

    # Для SM-2 преобразуем правильность в качество, если не задано явно.
    q = quality if quality is not None else (5 if correct else 1)

    # Обновляем состояние SRS.
    state = await _get_or_create_review_state(session, user_id, case_id)
    result = sm2(
        q,
        repetitions=state.repetitions,
        interval_days=state.interval_days,
        ease_factor=state.ease_factor,
    )
    state.repetitions = result.repetitions
    state.interval_days = result.interval_days
    state.ease_factor = result.ease_factor
    state.due_at = datetime.now(timezone.utc) + timedelta(days=result.interval_days)

    # Логируем повторение.
    session.add(
        ReviewLog(
            user_id=user_id,
            case_id=case_id,
            quality=q,
            repetitions=result.repetitions,
            interval_days=result.interval_days,
            ease_factor=result.ease_factor,
        )
    )

    return {
        "correct": correct,
        "is_correct": correct,
        "explanation": option.explanation,
        "sm2": {
            "repetitions": result.repetitions,
            "interval_days": result.interval_days,
            "ease_factor": round(result.ease_factor, 2),
            "due_at": state.due_at.isoformat(),
        },
    }


async def complete_lesson(
    session: AsyncSession,
    user_id: uuid.UUID,
    lesson_id: uuid.UUID,
    score: int,
) -> dict:
    """Завершает урок: обновляет прогресс и начисляет короны."""
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise LessonNotFoundError("Урок не найден")

    progress = await _get_or_create_progress(session, user_id, lesson_id)
    progress.attempts += 1
    progress.best_score = max(progress.best_score, score)
    progress.completed = True

    # Короны по лучшему результату.
    best = progress.best_score
    crowns = 3 if best >= 95 else 2 if best >= 75 else 1 if best >= 50 else 0
    progress.crowns = max(progress.crowns, crowns)

    return {
        "completed": progress.completed,
        "best_score": progress.best_score,
        "attempts": progress.attempts,
        "crowns": progress.crowns,
    }


async def _get_or_create_review_state(
    session: AsyncSession,
    user_id: uuid.UUID,
    case_id: uuid.UUID,
) -> ReviewState:
    """Возвращает состояние SRS для пары (user, case), создавая при необходимости."""
    state = await session.scalar(
        select(ReviewState).where(
            ReviewState.user_id == user_id,
            ReviewState.case_id == case_id,
        )
    )
    if state is None:
        state = ReviewState(
            user_id=user_id,
            case_id=case_id,
            due_at=datetime.now(timezone.utc),
        )
        session.add(state)
    return state