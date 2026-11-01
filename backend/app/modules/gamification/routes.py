"""Роуты модуля геймификации."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.auth.models import User
from app.modules.gamification import service
from app.modules.gamification.schemas import (
    GamificationRead,
    LeaderboardRead,
    ShopPurchaseIn,
    ShopPurchaseOut,
    XpAddIn,
    XpAddOut,
)

router = APIRouter(prefix="/gamification", tags=["gamification"])


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


@router.get("/me", response_model=GamificationRead)
async def gamification_me(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Возвращает уровень, стрик, XP и достижения пользователя."""
    user_id = _get_current_user_id(authorization)
    try:
        return await service.get_gamification_state(session, user_id)
    except service.GamificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post("/add-xp", response_model=XpAddOut)
async def gamification_add_xp(
    data: XpAddIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Начисляет XP пользователю (обновляет уровень и стрик)."""
    user_id = _get_current_user_id(authorization)
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    result = await service.add_xp(session, user, data.amount)
    await session.commit()
    return result


@router.get("/achievements")
async def gamification_achievements(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Возвращает достижения пользователя."""
    user_id = _get_current_user_id(authorization)
    achievements = await service.list_achievements(session, user_id)
    return {
        "achievements": [
            {
                "code": a.code,
                "title": a.title,
                "description": a.description,
                "awarded_at": a.awarded_at.isoformat(),
            }
            for a in achievements
        ]
    }


@router.get("/leaderboard", response_model=LeaderboardRead)
async def gamification_leaderboard(
    limit: int = Query(default=30, ge=1, le=100),
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Таблица лидеров лиги текущего пользователя (по реальным XP)."""
    user_id = _get_current_user_id(authorization)
    try:
        return await service.get_leaderboard(session, user_id, limit=limit)
    except service.GamificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post("/shop/purchase", response_model=ShopPurchaseOut)
async def gamification_shop_purchase(
    data: ShopPurchaseIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Покупает товар за гемы и возвращает остаток баланса."""
    user_id = _get_current_user_id(authorization)
    try:
        result = await service.purchase_shop_item(session, user_id, data.item)
    except service.UnknownShopItemError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except service.InsufficientGemsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except service.GamificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    await session.commit()
    return result
