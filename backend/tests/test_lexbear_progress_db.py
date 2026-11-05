"""Интеграционный тест завершения урока LexBear на реальной БД.

Регрессия: при первом прохождении урока ``LexBearProgress`` создавался без
явных нулей, а ``complete_lesson`` инкрементирует ``attempts`` до flush.
Python-side ``default=`` из модели применяется только при INSERT, поэтому
эндпоинт падал с 500 и ``TypeError: unsupported operand type(s) for +=``.
Без живой БД модуль пропускается.
"""

import uuid

import pytest
from sqlalchemy import select

from app.database import Base, async_session_factory, engine
from app.modules.auth.models import User
from app.modules.content import lexbear_service
from app.modules.content.lexbear_models import LexBearLesson, Question
from app.modules.progress.models import LexBearProgress


def _probe_database() -> bool:
    import asyncio

    async def _run() -> bool:
        async with engine.connect() as conn:
            await conn.run_sync(Base.metadata.create_all)
        return True

    try:
        ok = asyncio.run(_run())
    except Exception:  # noqa: BLE001 - любая ошибка подключения = БД недоступна
        return False
    finally:
        # Пул привязан к закрытому loop от asyncio.run(); см.
        # _reset_db_pool в conftest.py.
        engine.sync_engine.pool.dispose()
    return ok


if not _probe_database():  # pragma: no cover - зависит от окружения
    pytest.skip(
        "DATABASE_URL недоступен - интеграционные тесты LexBear пропущены",
        allow_module_level=True,
    )


async def _first_lesson_with_questions():
    """Возвращает урок и его вопросы из загруженного контент-пака."""
    async with async_session_factory() as session:
        lessons = (await session.scalars(select(LexBearLesson))).all()
        for lesson in lessons:
            questions = (
                await session.scalars(
                    select(Question).where(Question.lesson_id == lesson.id)
                )
            ).all()
            if questions:
                # Возвращаем id, а не объект: после закрытия сессии обращение
                # к атрибутам ORM-модели уйдёт в IO (MissingGreenlet).
                return lesson.id, questions
    return None, []


async def test_first_attempt_creates_progress_without_none_counters() -> None:
    lesson_id, questions = await _first_lesson_with_questions()
    if lesson_id is None:
        pytest.skip("контент не загружен (нужен POST /admin/content/reload)")

    # Первый вариант ответа на каждый вопрос: часть ответов будет неверной,
    # для регрессии это неважно - важен сам первый проход.
    answers = {str(q.id): 0 for q in questions}

    # Прогресс ссылается на users по FK - нужен реальный пользователь.
    async with async_session_factory() as session:
        user = User(
            email=f"lexbear-regress-{uuid.uuid4().hex[:8]}@example.com",
            hashed_password="x",
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    async with async_session_factory() as session:
        result = await lexbear_service.complete_lesson(
            session, user_id, lesson_id, answers
        )
        await session.commit()

    assert result["total"] == len(questions)
    assert 0 <= result["correct"] <= len(questions)

    async with async_session_factory() as session:
        progress = await session.scalar(
            select(LexBearProgress).where(
                LexBearProgress.user_id == user_id,
                LexBearProgress.lesson_id == lesson_id,
            )
        )
        assert progress is not None
        assert progress.attempts == 1
        assert progress.completed is True
        assert progress.best_score is not None
        assert progress.crowns is not None
        # Чистим за собой, чтобы не мусорить в локальной БД.
        await session.delete(progress)
        await session.commit()