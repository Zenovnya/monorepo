"""Первичный сид контента LexBear.

Контент вынесен в JSON-паки (``app/content_packs``) и загружается через
``content_loader``. Этот модуль оставлен для обратной совместимости и
«bootstrap»-семантики: заполняет БД только если контента ещё нет.

Для инкрементального добавления/обновления/удаления контента используйте
``content_loader.load_content(..., prune=...)`` (эндпоинт
``POST /admin/content/reload``), а не этот сид.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.content_loader import load_content
from app.modules.content.lexbear_models import Unit


async def run_lexbear_seed(session: AsyncSession) -> dict:
    """Заполняет контент из JSON-паков, если юнитов ещё нет (идемпотентно)."""
    existing = await session.scalar(select(Unit.id).limit(1))
    if existing is not None:
        return {"skipped": True}

    report = await load_content(session, prune=False)
    return {"skipped": False, **report}
