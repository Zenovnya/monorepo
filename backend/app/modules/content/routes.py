"""Роуты модуля контента."""

from fastapi import APIRouter

router = APIRouter(prefix="/content", tags=["content"])


@router.get("/courses")
async def list_courses() -> dict:
    """Заглушка: возвращает список курсов."""
    return {"courses": []}