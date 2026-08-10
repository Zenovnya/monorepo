"""Роуты модуля платежей."""

from fastapi import APIRouter, Depends

from app.modules.auth import service as auth_service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/subscriptions")
async def list_subscriptions(
    _: str = Depends(auth_service.get_bearer_token),
) -> dict:
    """Заглушка: возвращает список подписок."""
    return {"subscriptions": []}