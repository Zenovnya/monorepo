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
from app.modules.mascot import models as mascot_models  # noqa: F401
from app.modules.mascot.models import MascotPhrase

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

# Стартовый набор фраз маскота: не менее 3 фраз на каждый триггер.
# show_once=True только для приветствия при первом входе.
MASCOT_PHRASES = [
    # greeting
    {
        "trigger": "greeting",
        "phrase": "Привет! Готов немного подтянуть знание своих прав?",
        "emotion": "happy",
        "weight": 2,
        "show_once": False,
        "sort_order": 1,
    },
    {
        "trigger": "greeting",
        "phrase": "С возвращением! Продолжим?",
        "emotion": "waving",
        "weight": 1,
        "show_once": False,
        "sort_order": 2,
    },
    {
        "trigger": "greeting",
        "phrase": "Рад тебя видеть снова",
        "emotion": "neutral",
        "weight": 1,
        "show_once": False,
        "sort_order": 3,
    },
    # pet
    {
        "trigger": "pet",
        "phrase": "Хихи, щекотно!",
        "emotion": "wink",
        "weight": 2,
        "show_once": False,
        "sort_order": 1,
    },
    {
        "trigger": "pet",
        "phrase": "Ты чего творишь? Ладно, мне нравится",
        "emotion": "surprised",
        "weight": 1,
        "show_once": False,
        "sort_order": 2,
    },
    {
        "trigger": "pet",
        "phrase": "Ну ты и затейник",
        "emotion": "happy",
        "weight": 1,
        "show_once": False,
        "sort_order": 3,
    },
    # case_correct
    {
        "trigger": "case_correct",
        "phrase": "Отлично! Это твоё законное право",
        "emotion": "happy",
        "weight": 2,
        "show_once": False,
        "sort_order": 1,
    },
    {
        "trigger": "case_correct",
        "phrase": "Именно так! Ты явно готовишься",
        "emotion": "thumbsup",
        "weight": 1,
        "show_once": False,
        "sort_order": 2,
    },
    {
        "trigger": "case_correct",
        "phrase": "Верно! Так и запишем — ты знаешь закон",
        "emotion": "happy",
        "weight": 1,
        "show_once": False,
        "sort_order": 3,
    },
    # case_wrong
    {
        "trigger": "case_wrong",
        "phrase": "Не страшно, разберём вместе",
        "emotion": "thoughtful",
        "weight": 2,
        "show_once": False,
        "sort_order": 1,
    },
    {
        "trigger": "case_wrong",
        "phrase": "Почти! Давай посмотрим внимательнее",
        "emotion": "sad",
        "weight": 1,
        "show_once": False,
        "sort_order": 2,
    },
    {
        "trigger": "case_wrong",
        "phrase": "Бывает. Главное — теперь ты знаешь как правильно",
        "emotion": "sad",
        "weight": 1,
        "show_once": False,
        "sort_order": 3,
    },
    # app_first_open
    {
        "trigger": "app_first_open",
        "phrase": "Привет! Я Lex. Будем изучать законы вместе",
        "emotion": "waving",
        "weight": 1,
        "show_once": True,
        "sort_order": 1,
    },
    {
        "trigger": "app_first_open",
        "phrase": "Добро пожаловать! Начнём с самого важного",
        "emotion": "happy",
        "weight": 1,
        "show_once": True,
        "sort_order": 2,
    },
    {
        "trigger": "app_first_open",
        "phrase": "Здорово что ты здесь. Погнали разбираться в правах",
        "emotion": "thumbsup",
        "weight": 1,
        "show_once": True,
        "sort_order": 3,
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


async def _seed_mascot_phrases(session) -> None:
    """Заполняет mascot_phrases стартовым набором (идемпотентно)."""
    for phrase_data in MASCOT_PHRASES:
        existing = await session.scalar(
            select(MascotPhrase).where(
                MascotPhrase.trigger == phrase_data["trigger"],
                MascotPhrase.phrase == phrase_data["phrase"],
            )
        )
        if existing is not None:
            continue

        phrase = MascotPhrase(
            trigger=phrase_data["trigger"],
            phrase=phrase_data["phrase"],
            emotion=phrase_data["emotion"],
            weight=phrase_data["weight"],
            show_once=phrase_data["show_once"],
            is_active=True,
            sort_order=phrase_data["sort_order"],
        )
        session.add(phrase)
        print(f"  [phrase] создана ({phrase_data['trigger']}): {phrase_data['phrase'][:40]}...")


async def _seed_all() -> None:
    """Выполняет наполнение базы данных тестовыми данными."""
    # Создаём таблицы, если они ещё не созданы (удобно для локальной разработки).
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        print("Заполняем базу тестовыми данными...")
        await _seed_demo_user(session)
        await _seed_content(session)
        await _seed_mascot_phrases(session)
        await session.commit()
        print("Готово.")


def main() -> None:
    """Точка входа для запуска скрипта."""
    asyncio.run(_seed_all())


if __name__ == "__main__":
    main()