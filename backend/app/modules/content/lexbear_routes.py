"""Роуты контента LexBear (юниты, уроки, теория, вопросы, статьи)."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.admin.security import require_admin
from app.modules.auth import service as auth_service
from app.modules.content import lexbear_scoring, lexbear_service

router = APIRouter(prefix="/lexbear", tags=["lexbear"])


class LessonCompleteIn(BaseModel):
    """Схема завершения урока LexBear.

    Клиент присылает ответы на вопросы, а не готовый счёт: результат считает
    сервер (``lexbear_scoring``). ``correct``/``total`` из старого контракта
    принимаются только если ``answers`` не передан — они игнорируются для
    расчёта и логируются как расхождение, чтобы не ломать уже выпущенные
    сборки мобильного приложения.
    """

    answers: dict[str, Any] | None = Field(
        default=None,
        description="Ответы: id вопроса -> выбранный вариант(ы).",
    )
    correct: int | None = Field(
        default=None,
        ge=0,
        description="Устарело: не используется для расчёта результата.",
    )
    total: int | None = Field(
        default=None,
        ge=1,
        description="Устарело: не используется для расчёта результата.",
    )


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


@router.post("/seed", dependencies=[Depends(require_admin)])
async def seed(
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Запускает сид контента LexBear (идемпотентно).

    Защищён admin-токеном (заголовок ``X-Admin-Token``): служебный эндпоинт,
    недоступный обычным клиентам.
    """
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


@router.get("/cases/{case_id}")
async def case_detail(
    case_id: uuid.UUID,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Возвращает детали отдельного кейса по id."""
    try:
        return await lexbear_service.get_case(session, case_id)
    except lexbear_service.CaseNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


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
    """Завершает урок: начисляет XP, короны, стрик и разблокирует статьи.

    Результат считается на сервере по ответам пользователя. Если клиент
    прислал только ``correct``/``total`` (старый контракт), запрос
    отклоняется: доверять клиентскому счёту нельзя, а тихо засчитывать
    «0 из N» — значит обнулять честно пройденный урок.
    """
    user_id = _get_current_user_id(authorization)

    if not data.answers:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Передайте answers (id вопроса -> ответ): "
                "результат урока считается на сервере."
            ),
        )

    try:
        return await lexbear_service.complete_lesson(
            session,
            user_id,
            lesson_id,
            answers=data.answers,
        )
    except lexbear_service.LessonNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except lexbear_scoring.AnswerFormatError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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