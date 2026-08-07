"""Роуты модуля прогресса."""

from fastapi import APIRouter

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/overview")
async def progress_overview() -> dict:
    """Заглушка: возвращает сводку по прогрессу обучения."""
    return {"progress": {}}