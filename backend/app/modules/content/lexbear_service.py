"""Бизнес-логика контента LexBear (юниты, уроки, теория, вопросы, статьи)."""

import json
import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cache import cache_get, cache_set, content_version
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


class CaseNotFoundError(LexBearContentError):
    """Кейс LexBear не найден."""


async def list_units(
    session: AsyncSession,
) -> list[Unit]:
    """Возвращает активные юниты, отсортированные по порядку."""
    result = await session.scalars(
        select(Unit).where(Unit.is_active.is_(True)).order_by(Unit.order)
    )
    return list(result.all())


async def list_lessons_for_unit(
    session: AsyncSession,
    unit_id: int,
) -> list[LexBearLesson]:
    """Возвращает активные уроки юнита, отсортированные по порядку."""
    result = await session.scalars(
        select(LexBearLesson)
        .where(
            LexBearLesson.unit_id == unit_id,
            LexBearLesson.is_active.is_(True),
        )
        .order_by(LexBearLesson.order)
    )
    return list(result.all())


async def get_lesson_detail(
    session: AsyncSession,
    lesson_id: int,
) -> dict:
    """Возвращает детали урока: теорию и вопросы.

    Данные урока не зависят от пользователя, поэтому кэшируются в Redis
    (ключ включает версию контента — reload/CRUD инвалидирует кэш).
    """
    version = await content_version()
    cache_key = f"lexbear:v{version}:lesson:{lesson_id}"
    cached = await cache_get(cache_key)
    if cached is not None:
        try:
            return json.loads(cached)
        except (json.JSONDecodeError, TypeError):
            pass

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
    detail = {
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
    await cache_set(cache_key, json.dumps(detail), ttl=600)
    return detail


def _serialize_case(c) -> dict:
    """Преобразует ORM-кейс во вкладке «Кейсы» в словарь для API.

    Требует, чтобы связь ``options`` была уже загружена (selectinload),
    иначе обращение к ``c.options`` вызовет ленивую подгрузку. Функция
    синхронная — без обращений к БД.
    """
    correct_option = next((o for o in c.options if o.is_correct), None)
    return {
        "id": str(c.id),
        "title": c.title,
        "codex": c.codex,
        "difficulty": c.difficulty,
        "case_text": c.case_text,
        "hint": c.hint,
        "options": [{"id": o.id, "text": o.text} for o in c.options],
        "correct": next(
            (i for i, o in enumerate(c.options) if o.is_correct),
            None,
        ),
        "explanation": correct_option.explanation if correct_option else None,
        "featured": c.featured,
    }


async def list_cases(session: AsyncSession) -> list[dict]:
    """Возвращает кейсы для отдельной вкладки «Кейсы».

    Кейсы с заполненными полями LexBear (title, codex, difficulty, case_text).
    Варианты ответов загружаются одним запросом (selectinload) — без N+1.
    Результат кэшируется в Redis (ключ включает версию контента).
    """
    version = await content_version()
    cache_key = f"lexbear:v{version}:cases"
    cached = await cache_get(cache_key)
    if cached is not None:
        try:
            return json.loads(cached)
        except (json.JSONDecodeError, TypeError):
            pass

    result = await session.scalars(
        select(Case)
        .options(selectinload(Case.options))
        .where(Case.is_active.is_(True))
        .order_by(Case.created_at)
    )
    out = [
        _serialize_case(c)
        # Учитываем только кейсы, заполненные под вкладку «Кейсы».
        for c in result.all()
        if c.title and c.codex
    ]
    await cache_set(cache_key, json.dumps(out), ttl=600)
    return out


async def get_case(
    session: AsyncSession,
    case_id: uuid.UUID,
) -> dict:
    """Возвращает детали отдельного кейса вкладки «Кейсы» по id."""
    case = await session.scalar(
        select(Case)
        .options(selectinload(Case.options))
        .where(Case.id == case_id)
    )
    if case is None or not (case.title and case.codex):
        raise CaseNotFoundError("Кейс не найден")
    return _serialize_case(case)


async def get_learn_path(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[dict]:
    """Возвращает карту обучения с прогрессом пользователя по урокам."""
    units = await list_units(session)

    # Все активные уроки одним запросом (без N+1), затем группируем в памяти.
    lessons_result = await session.scalars(
        select(LexBearLesson)
        .where(LexBearLesson.is_active.is_(True))
        .order_by(LexBearLesson.unit_id, LexBearLesson.order)
    )
    lessons_by_unit: dict[int, list[LexBearLesson]] = {}
    for lesson in lessons_result.all():
        lessons_by_unit.setdefault(lesson.unit_id, []).append(lesson)

    progress_result = await session.scalars(
        select(LexBearProgress).where(LexBearProgress.user_id == user_id)
    )
    progress_map = {p.lesson_id: p for p in progress_result.all()}

    result = []
    for unit in units:
        lessons = lessons_by_unit.get(unit.id, [])
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
                        "id": lesson.id,
                        "title": lesson.title,
                        "order": lesson.order,
                        "xp_reward": lesson.xp_reward,
                        "completed": bool(
                            progress_map.get(lesson.id)
                            and progress_map[lesson.id].completed
                        ),
                    }
                    for lesson in lessons
                ],
            }
        )
    return result


async def list_articles(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[dict]:
    """Возвращает статьи со статусом «выучено» для пользователя."""
    articles = await session.scalars(
        select(Article).where(Article.is_active.is_(True)).order_by(Article.id)
    )
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

    Сравнение идёт по целым числовым токенам, а не по подстроке, иначе
    номер «1» ошибочно совпал бы с «15», «21» и т.п.

    Возвращает количество разблокированных статей.
    """
    # Числовые токены заголовка: "12", "12.1", "158" и т.п.
    title_numbers = set(re.findall(r"\d+(?:\.\d+)*", lesson_title or ""))
    articles = await session.scalars(
        select(Article).where(Article.is_active.is_(True))
    )
    unlocked = 0
    for article in articles.all():
        if article.number and article.number in title_numbers:
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
    # Используем add_xp: он обновляет уровень, стрик И инвалидирует кэш
    # состояния геймификации (иначе /gamification/me до 2 минут отдаёт старьё).
    from app.modules.auth.models import User
    from app.modules.gamification import service as gamification_service

    user = await session.get(User, user_id)

    # Фиксируем «до» — чтобы отдать клиенту флаги level_up / streak_incremented
    # и корректный список только что разблокированных ачивок. Клиент по этим
    # флагам решает, какие тосты с реакцией маскота показать.
    prev_level = user.level if user is not None else 0
    prev_streak = user.streak if user is not None else 0

    if user is not None:
        await gamification_service.add_xp(session, user, xp_gain)

    # Разблокировка статей по номеру в заголовке урока.
    unlocked = await unlock_articles_for_lesson(session, user_id, lesson.title)

    # Простые встроенные триггеры достижений (проверяются после add_xp,
    # чтобы обновлённый уровень уже был учтён). Идемпотентно за счёт
    # UniqueConstraint по (user_id, code) внутри award_achievement.
    achievements_unlocked: list[dict] = []
    if user is not None:
        # 1) Первый пройденный урок.
        if is_new:
            try:
                a = await gamification_service.award_achievement(
                    session, user,
                    code="first_lesson",
                    title="Первый шаг",
                    description="Ты прошёл свой первый урок. Погнали дальше.",
                )
                achievements_unlocked.append(_achievement_to_dict(a))
            except gamification_service.AchievementAlreadyAwardedError:
                pass
        # 2) Идеальный урок (100% без потерь).
        if accuracy >= 0.999:
            try:
                a = await gamification_service.award_achievement(
                    session, user,
                    code="perfect_lesson",
                    title="Идеально",
                    description="Прошёл урок без единой ошибки.",
                )
                achievements_unlocked.append(_achievement_to_dict(a))
            except gamification_service.AchievementAlreadyAwardedError:
                pass
        # 3) Streak-рубежи: 3, 7, 30 дней.
        for milestone in (3, 7, 30):
            if user.streak >= milestone > prev_streak:
                try:
                    a = await gamification_service.award_achievement(
                        session, user,
                        code=f"streak_{milestone}",
                        title=f"Стрик {milestone} дней",
                        description=f"Занимаешься {milestone} дней подряд.",
                    )
                    achievements_unlocked.append(_achievement_to_dict(a))
                except gamification_service.AchievementAlreadyAwardedError:
                    pass

    await session.commit()

    return {
        "ok": True,
        "xp_gain": xp_gain,
        "crowns": progress.crowns,
        "accuracy": round(accuracy * 100),
        "streak": user.streak if user else 0,
        "level": user.level if user else 0,
        "is_new": is_new,
        "unlocked_articles": unlocked,
        "completed": was_completed,
        # Флаги для мобилки, чтобы показать реакцию маскота нужным тостом.
        "level_up": bool(user and user.level > prev_level),
        "streak_incremented": bool(user and user.streak > prev_streak),
        "achievements_unlocked": achievements_unlocked,
    }


def _achievement_to_dict(a) -> dict:
    """Сериализует ORM-достижение в словарь для JSON-ответа."""
    return {
        "code": a.code,
        "title": a.title,
        "description": a.description,
    }