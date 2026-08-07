"""Роуты модуля SRS."""

from fastapi import APIRouter

router = APIRouter(prefix="/srs", tags=["srs"])


@router.get("/reviews")
async def list_reviews() -> dict:
    """Заглушка: возвращает список карточек на повторение."""
    return {"reviews": []}