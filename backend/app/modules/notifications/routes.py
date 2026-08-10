"""Роуты модуля уведомлений."""

from fastapi import APIRouter, Depends

from app.modules.auth import service as auth_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    _: str = Depends(auth_service.get_bearer_token),
) -> dict:
    """Заглушка: возвращает список уведомлений."""
    return {"notifications": []}