"""Роуты модуля прогресса."""

from fastapi import APIRouter, Depends

from app.modules.auth import service as auth_service

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/overview")
async def progress_overview(
    _: str = Depends(auth_service.get_bearer_token),
) -> dict:
    """Заглушка: возвращает сводку по прогрессу обучения."""
    return {"progress": {}}