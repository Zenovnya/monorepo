"""Первичный сид контента LexBear.

Контент вынесен в JSON-паки (``app/content_packs``) и загружается через
``content_loader``. Этот модуль оставлен для обратной совместимости и
«bootstrap»-семантики: заполняет БД только если контента ещё нет.

Для инкрементального добавления/обновления/удаления контента используйте
``content_loader.load_content(..., prune=...)`` (эндпоинт
``POST /admin/content/reload``), а не этот сид.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.content_loader import load_content
from app.modules.content.lexbear_models import LexBearLesson, Unit


async def run_lexbear_seed(session: AsyncSession, *, force: bool = False) -> dict:
    """Заполняет контент из JSON-паков (идемпотентно).

    Сид считается выполненным, когда есть и юниты, и уроки. Раньше проверялся
    только первый юнит: если предыдущий запуск упал между вставкой юнитов и
    уроков, повторный сид молча возвращал ``skipped``, и приложение оставалось
    с пустой картой обучения.

    :param force: перезаписать контент из паков, даже если он уже есть.
    """
    if not force:
        units = await session.scalar(select(func.count()).select_from(Unit)) or 0
        lessons = (
            await session.scalar(select(func.count()).select_from(LexBearLesson)) or 0
        )
        if units > 0 and lessons > 0:
            return {"skipped": True}

    report = await load_content(session, prune=False)
    return {"skipped": False, **report}
