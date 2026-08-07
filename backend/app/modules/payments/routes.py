"""Роуты модуля платежей."""

from fastapi import APIRouter

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/subscriptions")
async def list_subscriptions() -> dict:
    """Заглушка: возвращает список подписок."""
    return {"subscriptions": []}