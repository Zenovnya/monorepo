"""Роуты контента LexBear (юниты, уроки, теория, вопросы, статьи)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.content import lexbear_service

router = APIRouter(prefix="/lexbear", tags=["lexbear"])


class LessonCompleteIn(BaseModel):
    """Схема завершения урока LexBear."""

    correct: int = Field(ge=0)
    total: int = Field(ge=1)


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


@router.post("/seed")
async def seed(
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Запускает сид контента LexBear (идемпотентно)."""
    from app.modules.content import lexbear_seed

    result = await lexbear_seed.run_lexbear_seed(session)
    return result


@router.get("/learn")
async def learn_path(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Возвращает карту обучения (юниты + уроки + прогресс)."""
    user_id = _get_current_user_id(authorization)
    return await lexbear_service.get_learn_path(session, user_id)


@router.get("/cases")
async def cases(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Возвращает список кейсов для отдельной вкладки."""
    return await lexbear_service.list_cases(session)


@router.get("/lessons/{lesson_id}")
async def lesson_detail(
    lesson_id: int,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Возвращает детали урока (теория + вопросы)."""
    try:
        return await lexbear_service.get_lesson_detail(session, lesson_id)
    except lexbear_service.LessonNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(
    lesson_id: int,
    data: LessonCompleteIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Завершает урок: начисляет XP, короны, стрик и разблокирует статьи."""
    user_id = _get_current_user_id(authorization)
    try:
        return await lexbear_service.complete_lesson(
            session,
            user_id,
            lesson_id,
            correct=data.correct,
            total=data.total,
        )
    except lexbear_service.LessonNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/articles")
async def articles(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Возвращает статьи со статусом изучения."""
    user_id = _get_current_user_id(authorization)
    return await lexbear_service.list_articles(session, user_id)