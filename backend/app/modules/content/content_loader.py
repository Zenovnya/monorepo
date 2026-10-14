"""Загрузчик контента LexBear из JSON-паков (единый источник правды).

Идея «контент как данные»: весь учебный контент описан в JSON-файлах
(``app/content_packs``). Загрузчик выполняет идемпотентный upsert по стабильным
ключам (``code`` у юнитов/статей, ``slug`` у уроков/кейсов):

- новый объект в JSON → создаётся в БД;
- изменённый → обновляется;
- при ``prune=True`` отсутствующий в JSON объект деактивируется
  (``is_active=False``), но не удаляется физически — прогресс и история SRS
  сохраняются.

После загрузки версия контента инкрементируется, что инвалидирует кэш чтений.

Так добавление/удаление урока или кейса сводится к правке JSON и вызову
``reload`` — без правки кода и без перезапуска приложения.
"""

import json
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import bump_content_version
from app.modules.content.content_schemas import (
    ArticlesPack,
    CaseIn,
    CasesPack,
    CurriculumPack,
    LessonIn,
)
from app.modules.content.lexbear_models import (
    Article,
    LexBearLesson,
    Question,
    TheoryCard,
    Unit,
)
from app.modules.content.models import Case, CaseOption

# Каталог с JSON-паками по умолчанию: app/content_packs.
DEFAULT_PACKS_DIR = Path(__file__).resolve().parents[2] / "content_packs"


def _read_pack(packs_dir: Path, filename: str) -> dict:
    """Читает JSON-пак; отсутствующий файл трактуется как пустой пак."""
    path = packs_dir / filename
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _correct_index(options: list) -> int | None:
    """Индекс первого правильного варианта (для поля Case.correct)."""
    return next(
        (i for i, o in enumerate(options) if o.is_correct),
        None,
    )


async def _replace_lesson_children(
    session: AsyncSession, lesson: LexBearLesson, lesson_in: LessonIn
) -> None:
    """Пересоздаёт теорию и вопросы урока (у них нет внешних FK — безопасно)."""
    await session.execute(
        delete(TheoryCard).where(TheoryCard.lesson_id == lesson.id)
    )
    await session.execute(
        delete(Question).where(Question.lesson_id == lesson.id)
    )
    for card in lesson_in.cards:
        session.add(
            TheoryCard(
                lesson_id=lesson.id,
                order=card.order,
                title=card.title,
                definition=card.definition,
                practical=card.practical,
                chips=list(card.chips),
                bear_line=card.bear_line,
            )
        )
    for q in lesson_in.questions:
        session.add(
            Question(
                lesson_id=lesson.id,
                order=q.order,
                kind=q.kind,
                prompt=q.prompt,
                case_text=q.case_text,
                options=list(q.options),
                correct=q.correct,
                explanation=q.explanation,
            )
        )


async def upsert_case(session: AsyncSession, case_in: CaseIn) -> Case:
    """Создаёт/обновляет один кейс по ``slug`` и пересоздаёт его варианты.

    Не коммитит и не инкрементирует версию — это ответственность вызывающего
    (загрузчик пака или админ-роут).
    """
    case = await session.scalar(
        select(Case).where(Case.slug == case_in.slug)
    )
    if case is None:
        case = Case(slug=case_in.slug)
        session.add(case)

    case.title = case_in.title
    case.codex = case_in.codex
    case.difficulty = case_in.difficulty
    case.case_text = case_in.case_text
    case.situation = case_in.case_text
    case.featured = case_in.featured
    case.correct = _correct_index(case_in.options)
    case.hint = case_in.hint
    case.is_active = True
    await session.flush()

    # Пересоздаём варианты (на них нет внешних FK).
    await session.execute(
        delete(CaseOption).where(CaseOption.case_id == case.id)
    )
    for opt in case_in.options:
        session.add(
            CaseOption(
                case_id=case.id,
                text=opt.text,
                is_correct=opt.is_correct,
                explanation=opt.explanation,
            )
        )
    return case


class UnitNotFoundError(Exception):
    """Юнит с указанным ``code`` не найден (для upsert урока)."""


async def upsert_lesson(
    session: AsyncSession, unit_code: str, lesson_in: LessonIn
) -> LexBearLesson:
    """Создаёт/обновляет один урок по ``slug`` внутри юнита ``unit_code``.

    Пересоздаёт теорию и вопросы урока. Не коммитит и не инкрементирует версию
    — это ответственность вызывающего.
    """
    unit = await session.scalar(select(Unit).where(Unit.code == unit_code))
    if unit is None:
        raise UnitNotFoundError(f"Юнит не найден: {unit_code}")

    lesson = await session.scalar(
        select(LexBearLesson).where(LexBearLesson.slug == lesson_in.slug)
    )
    if lesson is None:
        lesson = LexBearLesson(slug=lesson_in.slug)
        session.add(lesson)
    lesson.unit_id = unit.id
    lesson.title = lesson_in.title
    lesson.order = lesson_in.order
    lesson.xp_reward = lesson_in.xp_reward
    lesson.is_active = True
    await session.flush()

    await _replace_lesson_children(session, lesson, lesson_in)
    return lesson


async def load_content(
    session: AsyncSession,
    *,
    prune: bool = False,
    packs_dir: Path | None = None,
) -> dict:
    """Загружает все паки (curriculum, articles, cases) в БД идемпотентно.

    :param prune: если True — деактивирует объекты, отсутствующие в JSON.
    :returns: отчёт с числом созданных/обновлённых/деактивированных объектов.
    """
    packs_dir = packs_dir or DEFAULT_PACKS_DIR

    curriculum = CurriculumPack(**_read_pack(packs_dir, "curriculum.json"))
    articles = ArticlesPack(**_read_pack(packs_dir, "articles.json"))
    cases = CasesPack(**_read_pack(packs_dir, "cases.json"))

    report = {
        "units": {"created": 0, "updated": 0},
        "lessons": {"created": 0, "updated": 0},
        "articles": {"created": 0, "updated": 0},
        "cases": {"created": 0, "updated": 0},
        "deactivated": {"units": 0, "lessons": 0, "articles": 0, "cases": 0},
    }

    seen_unit_codes: set[str] = set()
    seen_lesson_slugs: set[str] = set()
    seen_article_codes: set[str] = set()
    seen_case_slugs: set[str] = set()

    # --- Юниты + уроки + теория + вопросы ---
    for unit_in in curriculum.units:
        unit = await session.scalar(
            select(Unit).where(Unit.code == unit_in.code)
        )
        if unit is None:
            unit = Unit(code=unit_in.code)
            session.add(unit)
            report["units"]["created"] += 1
        else:
            report["units"]["updated"] += 1
        unit.codex = unit_in.codex
        unit.title = unit_in.title
        unit.subtitle = unit_in.subtitle
        unit.order = unit_in.order
        unit.color = unit_in.color
        unit.locked = unit_in.locked
        unit.why_practical = unit_in.why_practical
        unit.is_active = True
        await session.flush()
        seen_unit_codes.add(unit_in.code)

        for lesson_in in unit_in.lessons:
            lesson = await session.scalar(
                select(LexBearLesson).where(
                    LexBearLesson.slug == lesson_in.slug
                )
            )
            if lesson is None:
                lesson = LexBearLesson(slug=lesson_in.slug)
                session.add(lesson)
                report["lessons"]["created"] += 1
            else:
                report["lessons"]["updated"] += 1
            lesson.unit_id = unit.id
            lesson.title = lesson_in.title
            lesson.order = lesson_in.order
            lesson.xp_reward = lesson_in.xp_reward
            lesson.is_active = True
            await session.flush()
            seen_lesson_slugs.add(lesson_in.slug)

            await _replace_lesson_children(session, lesson, lesson_in)

    # --- Статьи (ключ — code) ---
    for article_in in articles.articles:
        article = await session.scalar(
            select(Article).where(Article.code == article_in.code)
        )
        if article is None:
            article = Article(code=article_in.code)
            session.add(article)
            report["articles"]["created"] += 1
        else:
            report["articles"]["updated"] += 1
        article.codex = article_in.codex
        article.number = article_in.number
        article.title = article_in.title
        article.plain = article_in.plain
        article.full = article_in.full
        article.is_active = True
        seen_article_codes.add(article_in.code)

    # --- Кейсы (ключ — slug) ---
    for case_in in cases.cases:
        existing = await session.scalar(
            select(Case.id).where(Case.slug == case_in.slug)
        )
        if existing is None:
            report["cases"]["created"] += 1
        else:
            report["cases"]["updated"] += 1
        await upsert_case(session, case_in)
        seen_case_slugs.add(case_in.slug)

    # --- Prune: мягко деактивируем то, чего нет в JSON ---
    if prune:
        report["deactivated"]["units"] = await _deactivate_missing(
            session, Unit, Unit.code, seen_unit_codes
        )
        report["deactivated"]["lessons"] = await _deactivate_missing(
            session, LexBearLesson, LexBearLesson.slug, seen_lesson_slugs
        )
        report["deactivated"]["articles"] = await _deactivate_missing(
            session, Article, Article.code, seen_article_codes
        )
        # Для кейсов управляем только теми, у кого задан slug (кейсы паков/
        # админки); legacy-кейсы, привязанные к урокам, не трогаем.
        report["deactivated"]["cases"] = await _deactivate_missing(
            session, Case, Case.slug, seen_case_slugs, require_key=True
        )

    await session.commit()
    await bump_content_version()
    return report


async def _deactivate_missing(
    session: AsyncSession,
    model,
    key_column,
    seen_keys: set[str],
    *,
    require_key: bool = False,
) -> int:
    """Деактивирует активные строки модели, ключ которых отсутствует в JSON.

    :param require_key: если True — трогаем только строки с непустым ключом
        (для кейсов: не затрагиваем legacy-кейсы без slug).
    """
    query = select(model).where(model.is_active.is_(True))
    if require_key:
        query = query.where(key_column.is_not(None))
    rows = list((await session.scalars(query)).all())

    count = 0
    for row in rows:
        key = getattr(row, key_column.key)
        if key not in seen_keys:
            row.is_active = False
            count += 1
    return count
