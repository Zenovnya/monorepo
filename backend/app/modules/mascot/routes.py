"""Роуты модуля маскота."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.mascot import service
from app.modules.mascot.schemas import (
    MascotPhraseRead,
    PetCountRead,
    PhraseRead,
)

router = APIRouter(prefix="/mascot", tags=["mascot"])


def _to_http_error(exc: service.MascotError) -> HTTPException:
    """Преобразует исключения сервиса в HTTP-ошибки."""
    if isinstance(exc, (service.UnknownTriggerError, service.NoPhrasesAvailableError)):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(exc),
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


@router.get(
    "/phrases",
    response_model=list[MascotPhraseRead],
)
async def list_phrases(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Возвращает список активных фраз маскота."""
    _get_current_user_id(authorization)
    return await service.list_active_phrases(session)


@router.get(
    "/phrase/{trigger}",
    response_model=PhraseRead,
)
async def get_phrase(
    trigger: str,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> PhraseRead:
    """Возвращает случайную фразу по триггеру."""
    user_id = _get_current_user_id(authorization)
    try:
        phrase = await service.get_phrase_for_trigger(session, trigger, user_id)
    except service.MascotError as exc:
        raise _to_http_error(exc) from exc
    return PhraseRead.model_validate(phrase)


@router.post(
    "/pet",
    response_model=PetCountRead,
)
async def pet(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> PetCountRead:
    """Погладить маскота: увеличивает счётчик поглаживаний."""
    user_id = _get_current_user_id(authorization)
    pet_count = await service.increment_pet_count(session, user_id)
    await session.commit()
    return PetCountRead(pet_count=pet_count)


@router.get(
    "/pet-count",
    response_model=PetCountRead,
)
async def pet_count(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> PetCountRead:
    """Возвращает текущий счётчик поглаживаний."""
    user_id = _get_current_user_id(authorization)
    pet_count = await service.get_pet_count(session, user_id)
    return PetCountRead(pet_count=pet_count)