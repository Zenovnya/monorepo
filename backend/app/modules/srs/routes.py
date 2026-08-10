"""Роуты модуля SRS."""

from fastapi import APIRouter, Depends

from app.modules.auth import service as auth_service

router = APIRouter(prefix="/srs", tags=["srs"])


@router.get("/reviews")
async def list_reviews(
    _: str = Depends(auth_service.get_bearer_token),
) -> dict:
    """Заглушка: возвращает список карточек на повторение."""
    return {"reviews": []}