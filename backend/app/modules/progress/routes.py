"""Роуты модуля прогресса."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.progress import service
from app.modules.progress.schemas import (
    ProgressAnswerIn,
    ProgressAnswerOut,
    ProgressCompleteIn,
    ProgressCompleteOut,
    ProgressOverviewRead,
)

router = APIRouter(prefix="/progress", tags=["progress"])


def _get_current_user_id(
    authorization: str,
) -> uuid.UUID:
    """Декодирует access-токен и возвращает идентификатор пользователя."""
    try:
        return auth_service.decode_access_token(authorization)
    except auth_service.AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


def _to_http_error(exc: service.ProgressError) -> HTTPException:
    """Преобразует исключения сервиса в HTTP-ошибки."""
    if isinstance(exc, (service.LessonNotFoundError, service.CaseNotFoundError)):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(exc),
    )


@router.get("", response_model=ProgressOverviewRead)
async def get_progress(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Возвращает сводку прогресса пользователя по урокам."""
    user_id = _get_current_user_id(authorization)
    items = await service.get_progress(session, user_id)
    return {
        "items": [
            {
                "lesson_id": p.lesson_id,
                "completed": p.completed,
                "best_score": p.best_score,
                "attempts": p.attempts,
                "crowns": p.crowns,
            }
            for p in items
        ],
        "total_completed": sum(1 for p in items if p.completed),
        "total_crowns": sum(p.crowns for p in items),
    }


@router.post("/answer", response_model=ProgressAnswerOut)
async def progress_answer(
    data: ProgressAnswerIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Обрабатывает ответ на кейс и обновляет SRS."""
    user_id = _get_current_user_id(authorization)
    try:
        result = await service.answer_case(
            session,
            user_id,
            data.case_id,
            data.option_id,
            quality=data.quality,
        )
    except service.ProgressError as exc:
        raise _to_http_error(exc) from exc
    await session.commit()

    # Аналитика: событие следования подсказке LexEntrance.
    if result.get("correct"):
        from app.modules.analytics import service as analytics_service

        await analytics_service.track_lex_entrance_hint_followed(
            user_id, str(data.case_id)
        )

    return result


@router.post("/complete", response_model=ProgressCompleteOut)
async def complete_lesson(
    data: ProgressCompleteIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Завершает урок: обновляет прогресс и начисляет короны."""
    user_id = _get_current_user_id(authorization)
    try:
        return await service.complete_lesson(
            session,
            user_id,
            data.lesson_id,
            data.score,
        )
    except service.ProgressError as exc:
        raise _to_http_error(exc) from exc