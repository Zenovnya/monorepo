"""Скрипт наполнения базы данных тестовыми данными.

Запуск (из каталога ``backend``):

    python -m app.seed

Скрипт идемпотентен: повторный запуск не создаёт дубликатов.
"""

import asyncio

from sqlalchemy import select

from app.database import Base, async_session_factory, engine
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.auth.models import User
from app.modules.auth.service import hash_password
from app.modules.content import models as content_models  # noqa: F401
from app.modules.content.models import Branch, Case, CaseOption, Lesson

DEMO_USER_EMAIL = "demo@example.com"
DEMO_USER_PASSWORD = "demo-password"

BRANCHES = [
    {
        "title": "Полиция",
        "description": "Основы взаимодействия с сотрудниками полиции.",
        "icon": "police",
        "is_premium": False,
        "sort_order": 1,
        "lessons": [
            {
                "title": "Права и обязанности",
                "content": (
                    "Каждый гражданин имеет права и обязанности при "
                    "взаимодействии с сотрудниками полиции."
                ),
                "sort_order": 1,
                "cases": [
                    {
                        "situation": "Вас остановил инспектор на дороге.",
                        "case_type": "lex_entrance",
                        "lex_entrance_type": "scooter",
                        "lex_hint_text": "Спокойно, сначала узнай причину.",
                        "lex_hint_option_id": 1,
                        "sort_order": 1,
                        "options": [
                            {
                                "text": "Остановиться и узнать причину",
                                "is_correct": True,
                                "explanation": (
                                    "Правильно: при остановке следует "
                                    "остановиться и выяснить причину."
                                ),
                            },
                            {
                                "text": "Попытаться уехать",
                                "is_correct": False,
                                "explanation": (
                                    "Неверно: попытка скрыться ухудшает "
                                    "ситуацию."
                                ),
                            },
                        ],
                    },
                ],
            },
        ],
    },
]


async def _seed_demo_user(session) -> None:
    """Создаёт демонстрационного пользователя, если его ещё нет."""
    existing = await session.scalar(
        select(User).where(User.email == DEMO_USER_EMAIL)
    )
    if existing is not None:
        return

    user = User(
        email=DEMO_USER_EMAIL,
        username="Demo User",
        hashed_password=hash_password(DEMO_USER_PASSWORD),
        is_active=True,
    )
    session.add(user)
    await session.flush()
    print(f"  [user] создан: {DEMO_USER_EMAIL}")


async def _seed_content(session) -> None:
    """Создаёт ветки, уроки, кейсы и варианты ответов (идемпотентно)."""
    for branch_data in BRANCHES:
        branch = await session.scalar(
            select(Branch).where(Branch.title == branch_data["title"])
        )
        if branch is not None:
            continue

        branch = Branch(
            title=branch_data["title"],
            description=branch_data.get("description"),
            icon=branch_data.get("icon"),
            is_premium=branch_data.get("is_premium", False),
            sort_order=branch_data.get("sort_order", 0),
        )
        session.add(branch)
        await session.flush()
        print(f"  [branch] создана: {branch.title}")

        for lesson_data in branch_data["lessons"]:
            lesson = Lesson(
                branch_id=branch.id,
                title=lesson_data["title"],
                content=lesson_data.get("content"),
                sort_order=lesson_data.get("sort_order", 0),
            )
            session.add(lesson)
            await session.flush()
            print(f"    [lesson] создан: {lesson.title}")

            for case_data in lesson_data["cases"]:
                case = Case(
                    lesson_id=lesson.id,
                    situation=case_data["situation"],
                    case_type=case_data.get("case_type", "simple"),
                    sort_order=case_data.get("sort_order", 0),
                    lex_entrance_type=case_data.get("lex_entrance_type"),
                    lex_hint_text=case_data.get("lex_hint_text"),
                    lex_hint_option_id=case_data.get("lex_hint_option_id"),
                )
                session.add(case)
                await session.flush()
                print(f"      [case] создан: {case.situation[:40]}...")

                for option_data in case_data["options"]:
                    option = CaseOption(
                        case_id=case.id,
                        text=option_data["text"],
                        is_correct=option_data.get("is_correct", False),
                        explanation=option_data.get("explanation"),
                    )
                    session.add(option)


async def _seed_all() -> None:
    """Выполняет наполнение базы данных тестовыми данными."""
    # Создаём таблицы, если они ещё не созданы (удобно для локальной разработки).
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        print("Заполняем базу тестовыми данными...")
        await _seed_demo_user(session)
        await _seed_content(session)
        await session.commit()
        print("Готово.")


def main() -> None:
    """Точка входа для запуска скрипта."""
    asyncio.run(_seed_all())


if __name__ == "__main__":
    main()