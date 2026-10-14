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


@router.get("/phrases", response_model=list[MascotPhraseRead])
async def list_phrases(
    _: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Возвращает список активных фраз маскота."""
    return await service.list_active_phrases(session)


@router.get("/phrase/{trigger}", response_model=PhraseRead)
async def phrase_for_trigger(
    trigger: str,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> PhraseRead:
    """Возвращает случайную фразу по триггеру."""
    user_id = _get_current_user_id(authorization)
    try:
        phrase = await service.get_phrase_for_trigger(
            session, trigger, user_id
        )
    except service.MascotError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    await session.commit()
    return PhraseRead(
        id=phrase.id,
        phrase=phrase.phrase,
        emotion=phrase.emotion,
    )


@router.get("/pet-count", response_model=PetCountRead)
async def pet_count(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> PetCountRead:
    """Возвращает счётчик поглаживаний пользователя."""
    user_id = _get_current_user_id(authorization)
    count = await service.get_pet_count(session, user_id)
    return PetCountRead(pet_count=count)


@router.post("/pet", response_model=PetCountRead)
async def pet(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> PetCountRead:
    """Погладить маскота: увеличивает счётчик поглаживаний."""
    user_id = _get_current_user_id(authorization)
    pet_count = await service.increment_pet_count(session, user_id)
    await session.commit()

    # Отправляем событие аналитики в фоне (не блокирует ответ:
    # запрос к Amplitude может занимать до 5 секунд).
    from app.modules.analytics import service as analytics_service

    analytics_service.fire_and_forget(analytics_service.track_mascot_petted(user_id))

    return PetCountRead(pet_count=pet_count)