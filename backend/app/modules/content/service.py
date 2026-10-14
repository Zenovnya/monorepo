"""Бизнес-логика модуля контента.

Сервисный слой отделён от роутов, что позволяет покрыть его
unit-тестами без реальной базы данных (аналогично auth-модулю).
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import Branch, Case, Lesson


class ContentError(Exception):
    """Базовое исключение модуля контента."""


class BranchNotFoundError(ContentError):
    """Ветка не найдена."""


class LessonNotFoundError(ContentError):
    """Урок не найден."""


async def list_branches(session: AsyncSession) -> list[Branch]:
    """Возвращает все ветки, отсортированные по sort_order."""
    result = await session.scalars(
        select(Branch).order_by(Branch.sort_order, Branch.title)
    )
    return list(result.all())


async def get_branch_or_404(
    session: AsyncSession, branch_id: uuid.UUID
) -> Branch:
    """Возвращает ветку по id или выбрасывает BranchNotFoundError."""
    branch = await session.get(Branch, branch_id)
    if branch is None:
        raise BranchNotFoundError("Ветка не найдена")
    return branch


async def list_lessons(
    session: AsyncSession, branch_id: uuid.UUID
) -> list[Lesson]:
    """Возвращает уроки ветки, отсортированные по sort_order."""
    # Проверяем существование ветки, чтобы вернуть понятную ошибку.
    await get_branch_or_404(session, branch_id)
    result = await session.scalars(
        select(Lesson)
        .where(Lesson.branch_id == branch_id)
        .order_by(Lesson.sort_order, Lesson.title)
    )
    return list(result.all())


async def get_lesson_or_404(
    session: AsyncSession, lesson_id: uuid.UUID
) -> Lesson:
    """Возвращает урок по id или выбрасывает LessonNotFoundError."""
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise LessonNotFoundError("Урок не найден")
    return lesson


async def list_cases(session: AsyncSession, lesson_id: uuid.UUID) -> list[Case]:
    """Возвращает кейсы урока с вариантами ответа, отсортированные по sort_order."""
    # Проверяем существование урока, чтобы вернуть понятную ошибку.
    await get_lesson_or_404(session, lesson_id)
    result = await session.scalars(
        select(Case)
        .where(Case.lesson_id == lesson_id)
        .order_by(Case.sort_order, Case.created_at)
    )
    cases = list(result.all())
    # Загружаем варианты ответов (отношение). При асинхронной сессии
    # без lazy='selectin' потребуется отдельная загрузка — делаем её здесь.
    for case in cases:
        await session.refresh(case, attribute_names=["options"])
    return cases