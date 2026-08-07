"""Роуты модуля уведомлений."""

from fastapi import APIRouter

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications() -> dict:
    """Заглушка: возвращает список уведомлений."""
    return {"notifications": []}