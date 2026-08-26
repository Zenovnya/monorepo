"""Роуты модуля пользовательского профиля."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.auth.models import User
from app.modules.user.schemas import OnboardIn, OnboardOut, PetBearOut

router = APIRouter(prefix="/user", tags=["user"])


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


@router.post("/onboard", response_model=OnboardOut)
async def onboard(
    data: OnboardIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Завершает онбординг пользователя."""
    user_id = _get_current_user_id(authorization)
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    from app.modules.user import service

    result = await service.onboard_user(
        session,
        user,
        goal=data.goal,
        minutes=data.minutes,
        codex=data.codex,
        name=data.name,
    )
    return result


@router.post("/bear/pet", response_model=PetBearOut)
async def pet_bear(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Погладить мишку: повышает настроение."""
    user_id = _get_current_user_id(authorization)
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Получаем счётчик поглаживаний из модуля маскота.
    from app.modules.mascot import service as mascot_service

    pet_count = await mascot_service.increment_pet_count(session, user_id)

    from app.modules.user import service

    result = await service.pet_bear(session, user, pet_count)
    return result