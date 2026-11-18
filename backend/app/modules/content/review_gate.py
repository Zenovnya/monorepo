"""Видимость кейсов: единое правило для всех путей к контенту.

Кейсы живут в двух местах: адаптивный банк (``learning_case_versions``) со
статусом юридической проверки и legacy-таблица ``cases`` со вкладкой «Кейсы»,
где поля статуса нет. Связь между ними — ``cases.slug`` →
``learning_case_versions.source_slug``: и паки, и импорт в банк ключуются одним
и тем же slug'ом.

Модуль отдельный, а не функция в ``lexbear_service``, потому что им пользуются и
контент, и прогресс: иначе получается циклический импорт
(``lexbear_service`` → ``progress.models`` → ``progress.routes`` → …).
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import Case
from app.modules.learning.models import CaseVersion, LearningCase
from app.modules.learning.constants import PUBLISHED_REVIEW_STATUS


async def reviewed_case_slugs(session: AsyncSession, slugs: list[str]) -> set[str]:
    """Slug'и из перечисленных, которые видны пользователю.

    Два условия, и оба обязательны:

    1. ``review_status == approved`` — юридическая проверка. Без этой связи
       гейт обходился: ``/learning/next`` не отдавал непроверенный кейс, а
       ``/lexbear/cases`` показывал его в списке со всеми вариантами ответов.
    2. версия не снята с публикации. Мягкое удаление в админке
       (``DELETE /admin/content/cases/{slug}?hard=false``) выставляет
       ``Case.is_active = False``, но адаптивный банк об этом не знал: кейс
       исчезал из вкладки «Кейсы» и продолжал приходить в ``/learning/next``.
       ``retire_legacy_case`` переносит это решение в ``CaseVersion.status``.
    """
    if not slugs:
        return set()
    rows = (await session.execute(
        select(CaseVersion.source_slug)
        .join(LearningCase)
        .where(
            CaseVersion.source_slug.in_(slugs),
            CaseVersion.status == "published",
            LearningCase.status == "published",
            CaseVersion.review_status == PUBLISHED_REVIEW_STATUS,
        )
    )).scalars().all()
    return {slug for slug in rows if slug}


async def retire_legacy_case(session: AsyncSession, slug: str) -> int:
    """Снимает с публикации версии кейса в адаптивном банке.

    Вызывается при мягком удалении в админке: решение «этот кейс больше не
    показываем» должно действовать на всех путях, а не только на legacy-вкладке.
    Возвращает число снятых версий.
    """
    versions = (await session.execute(
        select(CaseVersion).where(
            CaseVersion.source_slug == slug,
            CaseVersion.status == "published",
        )
    )).scalars().all()
    for version in versions:
        version.status = "retired"
    return len(versions)


async def is_legacy_case_reviewed(session: AsyncSession, case: Case) -> bool:
    """Проверен ли конкретный legacy-кейс (для точечных запросов по id)."""
    return bool(case.slug) and bool(await reviewed_case_slugs(session, [case.slug]))


async def is_case_id_visible(session: AsyncSession, case_id: uuid.UUID) -> bool:
    """Можно ли показывать legacy-кейс по его id."""
    case = await session.get(Case, case_id)
    return case is not None and await is_legacy_case_reviewed(session, case)
