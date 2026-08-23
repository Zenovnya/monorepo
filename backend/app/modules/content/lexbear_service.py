"""Бизнес-логика контента LexBear (юниты, уроки, теория, вопросы, статьи)."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.lexbear_models import (
    Article,
    LearnedArticle,
    LexBearLesson,
    Question,
    TheoryCard,
    Unit,
)
from app.modules.content.models import Case
from app.modules.progress.models import LexBearProgress


class LexBearContentError(Exception):
    """Базовое исключение модуля контента LexBear."""


class LessonNotFoundError(LexBearContentError):
    """Урок LexBear не найден."""


async def list_units(
    session: AsyncSession,
) -> list[Unit]:
    """Возвращает все юниты, отсортированные по порядку."""
    result = await session.scalars(select(Unit).order_by(Unit.order))
    return list(result.all())


async def list_lessons_for_unit(
    session: AsyncSession,
    unit_id: int,
) -> list[LexBearLesson]:
    """Возвращает уроки юнита, отсортированные по порядку."""
    result = await session.scalars(
        select(LexBearLesson)
        .where(LexBearLesson.unit_id == unit_id)
        .order_by(LexBearLesson.order)
    )
    return list(result.all())


async def get_lesson_detail(
    session: AsyncSession,
    lesson_id: int,
) -> dict:
    """Возвращает детали урока: теорию и вопросы."""
    lesson = await session.get(LexBearLesson, lesson_id)
    if lesson is None:
        raise LessonNotFoundError("Урок не найден")

    cards_result = await session.scalars(
        select(TheoryCard)
        .where(TheoryCard.lesson_id == lesson_id)
        .order_by(TheoryCard.order)
    )
    questions_result = await session.scalars(
        select(Question)
        .where(Question.lesson_id == lesson_id)
        .order_by(Question.order)
    )
    return {
        "id": lesson.id,
        "title": lesson.title,
        "xp_reward": lesson.xp_reward,
        "unit_id": lesson.unit_id,
        "cards": [
            {
                "id": c.id,
                "title": c.title,
                "definition": c.definition,
                "practical": c.practical,
                "chips": c.chips or [],
                "bear_line": c.bear_line,
            }
            for c in cards_result.all()
        ],
        "questions": [
            {
                "id": q.id,
                "kind": q.kind,
                "prompt": q.prompt,
                "case_text": q.case_text,
                "options": q.options or [],
                "correct": q.correct,
                "explanation": q.explanation,
            }
            for q in questions_result.all()
        ],
    }


async def list_cases(session: AsyncSession) -> list[dict]:
    """Возвращает кейсы для отдельной вкладки «Кейсы».

    Кейсы с заполненными полями LexBear (title, codex, difficulty, case_text).
    """
    result = await session.scalars(select(Case).order_by(Case.created_at))
    cases = list(result.all())
    out = []
    for c in cases:
        # Учитываем только кейсы, заполненные под вкладку «Кейсы».
        if not (c.title and c.codex):
            continue
        # Явно загружаем options (асинхронная сессия без lazy='selectin').
        await session.refresh(c, attribute_names=["options"])
        correct_option = next((o for o in c.options if o.is_correct), None)
        out.append(
            {
                "id": str(c.id),
                "title": c.title,
                "codex": c.codex,
                "difficulty": c.difficulty,
                "case_text": c.case_text,
                "options": [{"id": o.id, "text": o.text} for o in c.options],
                "correct": next(
                    (i for i, o in enumerate(c.options) if o.is_correct),
                    None,
                ),
                "explanation": correct_option.explanation if correct_option else None,
                "featured": c.featured,
            }
        )
    return out


async def get_learn_path(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[dict]:
    """Возвращает карту обучения с прогрессом пользователя по урокам."""
    units = await list_units(session)
    progress_result = await session.scalars(
        select(LexBearProgress).where(LexBearProgress.user_id == user_id)
    )
    progress_map = {p.lesson_id: p for p in progress_result.all()}

    result = []
    for unit in units:
        lessons = await list_lessons_for_unit(session, unit.id)
        result.append(
            {
                "id": unit.id,
                "code": unit.code,
                "codex": unit.codex,
                "title": unit.title,
                "subtitle": unit.subtitle,
                "order": unit.order,
                "color": unit.color,
                "locked": unit.locked,
                "why_practical": unit.why_practical,
                "lessons": [
                    {
                        "id": l.id,
                        "title": l.title,
                        "order": l.order,
                        "xp_reward": l.xp_reward,
                        "completed": bool(
                            progress_map.get(l.id)
                            and progress_map[l.id].completed
                        ),
                    }
                    for l in lessons
                ],
            }
        )
    return result


async def list_articles(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[dict]:
    """Возвращает статьи со статусом «выучено» для пользователя."""
    articles = await session.scalars(select(Article).order_by(Article.id))
    learned_result = await session.scalars(
        select(LearnedArticle).where(LearnedArticle.user_id == user_id)
    )
    learned_ids = {la.article_id for la in learned_result.all()}
    return [
        {
            "id": a.id,
            "code": a.code,
            "codex": a.codex,
            "number": a.number,
            "title": a.title,
            "plain": a.plain,
            "full": a.full,
            "learned": a.id in learned_ids,
        }
        for a in articles.all()
    ]


async def unlock_articles_for_lesson(
    session: AsyncSession,
    user_id: uuid.UUID,
    lesson_title: str,
) -> int:
    """Разблокирует статьи, номер которых встречается в заголовке урока.

    Возвращает количество разблокированных статей.
    """
    articles = await session.scalars(select(Article))
    unlocked = 0
    for article in articles.all():
        if article.number and article.number in lesson_title:
            existing = await session.scalar(
                select(LearnedArticle).where(
                    LearnedArticle.user_id == user_id,
                    LearnedArticle.article_id == article.id,
                )
            )
            if existing is None:
                session.add(
                    LearnedArticle(user_id=user_id, article_id=article.id)
                )
                unlocked += 1
    return unlocked


async def complete_lesson(
    session: AsyncSession,
    user_id: uuid.UUID,
    lesson_id: int,
    correct: int,
    total: int,
) -> dict:
    """Завершает урок LexBear: начисляет XP, короны, стрик и разблокирует статьи.

    Возвращает результат, аналогичный веб-эндпоинту /api/lesson/complete.
    """
    lesson = await session.get(LexBearLesson, lesson_id)
    if lesson is None:
        raise LessonNotFoundError("Урок не найден")

    accuracy = correct / total if total > 0 else 0
    crowns = 3 if accuracy >= 0.95 else 2 if accuracy >= 0.75 else 1 if accuracy >= 0.5 else 0
    xp_gain = max(2, round(lesson.xp_reward * max(0.3, accuracy)))

    # Upsert прогресса LexBear.
    progress = await session.scalar(
        select(LexBearProgress).where(
            LexBearProgress.user_id == user_id,
            LexBearProgress.lesson_id == lesson_id,
        )
    )
    is_new = progress is None
    if progress is None:
        progress = LexBearProgress(
            user_id=user_id,
            lesson_id=lesson_id,
        )
        session.add(progress)

    was_completed = progress.completed
    progress.attempts += 1
    progress.best_score = max(progress.best_score, round(accuracy * 100))
    progress.crowns = max(progress.crowns, crowns)
    progress.completed = True

    # Начисляем XP и обновляем стрик через геймификацию.
    from app.modules.auth.models import User
    from app.modules.gamification import service as gamification_service

    user = await session.get(User, user_id)
    if user is not None:
        gamification_service.update_streak(user)
        user.xp += xp_gain
        new_level = gamification_service.level_from_xp(user.xp)
        user.level = new_level

    # Разблокировка статей по номеру в заголовке урока.
    unlocked = await unlock_articles_for_lesson(session, user_id, lesson.title)

    await session.commit()

    return {
        "ok": True,
        "xp_gain": xp_gain,
        "crowns": progress.crowns,
        "accuracy": round(accuracy * 100),
        "streak": user.streak if user else 0,
        "is_new": is_new,
        "unlocked_articles": unlocked,
        "completed": was_completed,
    }