"""Роуты модуля контента."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.content import service
from app.modules.content.schemas import BranchRead, CaseRead, LessonRead

router = APIRouter(prefix="/content", tags=["content"])


def _to_http_error(exc: service.ContentError) -> HTTPException:
    """Преобразует исключения сервиса в HTTP-ошибки."""
    if isinstance(exc, (service.BranchNotFoundError, service.LessonNotFoundError)):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(exc),
    )


@router.get(
    "/branches",
    response_model=list[BranchRead],
)
async def list_branches(
    _: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Возвращает список веток обучения."""
    return await service.list_branches(session)


@router.get(
    "/branches/{branch_id}/lessons",
    response_model=list[LessonRead],
)
async def list_lessons(
    branch_id: uuid.UUID,
    _: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Возвращает уроки конкретной ветки."""
    try:
        return await service.list_lessons(session, branch_id)
    except service.ContentError as exc:
        raise _to_http_error(exc) from exc


@router.get(
    "/lessons/{lesson_id}",
    response_model=LessonRead,
)
async def get_lesson(
    lesson_id: uuid.UUID,
    _: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> LessonRead:
    """Возвращает детали урока."""
    try:
        lesson = await service.get_lesson_or_404(session, lesson_id)
    except service.ContentError as exc:
        raise _to_http_error(exc) from exc
    return LessonRead.model_validate(lesson)


@router.get(
    "/lessons/{lesson_id}/cases",
    response_model=list[CaseRead],
)
async def list_cases(
    lesson_id: uuid.UUID,
    _: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Возвращает кейсы урока (с полями Lex)."""
    try:
        return await service.list_cases(session, lesson_id)
    except service.ContentError as exc:
        raise _to_http_error(exc) from exc