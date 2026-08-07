"""Роуты модуля аутентификации."""

from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def get_current_user() -> dict:
    """Заглушка: возвращает данные текущего пользователя."""
    return {"user": None}