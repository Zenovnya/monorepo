"""Служебные (admin) роуты управления контентом.

Все эндпоинты защищены admin-токеном (``X-Admin-Token``) и предназначены для
внутренней веб-админки и деплой-скриптов, а не для мобильных клиентов.

Механизм двухрежимный:
- ``POST /admin/content/reload`` — массовая загрузка/синхронизация из JSON-паков
  (``app/content_packs``) с опцией ``prune`` (мягкое удаление отсутствующего);
- CRUD кейсов/уроков — точечные правки прямо в БД (для нетехнического
  редактора через веб-форму), без правки файлов и редеплоя.

После любой записи инкрементируется версия контента → кэш чтений
инвалидируется, и мобильное приложение сразу видит изменения.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cache import bump_content_version
from app.database import get_session
from app.modules.admin.security import require_admin
from app.modules.content import content_loader
from app.modules.content.content_schemas import CaseIn, LessonIn
from app.modules.content.lexbear_models import LexBearLesson, Question, TheoryCard, Unit
from app.modules.content.models import Case

router = APIRouter(
    prefix="/admin/content",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


# ---------------------------------------------------------------------------
# Массовая загрузка из JSON-паков
# ---------------------------------------------------------------------------
@router.post("/reload")
async def reload_content(
    prune: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Загружает/синхронизирует контент из JSON-паков.

    :param prune: если true — деактивирует контент, отсутствующий в JSON
        (мягкое удаление; прогресс и SRS сохраняются).
    """
    report = await content_loader.load_content(session, prune=prune)
    return {"ok": True, "prune": prune, "report": report}


# ---------------------------------------------------------------------------
# Кейсы (CRUD)
# ---------------------------------------------------------------------------
def _serialize_case_admin(case: Case) -> dict:
    """Полная сериализация кейса для админки (включая правильность и slug)."""
    return {
        "id": str(case.id),
        "slug": case.slug,
        "title": case.title,
        "codex": case.codex,
        "difficulty": case.difficulty,
        "case_text": case.case_text,
        "featured": case.featured,
        "is_active": case.is_active,
        "options": [
            {
                "id": o.id,
                "text": o.text,
                "is_correct": o.is_correct,
                "explanation": o.explanation,
            }
            for o in case.options
        ],
    }


@router.get("/cases")
async def admin_list_cases(
    include_inactive: bool = True,
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Возвращает кейсы вкладки «Кейсы» (по умолчанию — включая деактивированные)."""
    query = (
        select(Case)
        .options(selectinload(Case.options))
        .where(Case.slug.is_not(None))
        .order_by(Case.created_at)
    )
    if not include_inactive:
        query = query.where(Case.is_active.is_(True))
    cases = (await session.scalars(query)).all()
    return [_serialize_case_admin(c) for c in cases]


@router.put("/cases")
async def admin_upsert_case(
    case_in: CaseIn,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Создаёт или обновляет кейс по ``slug`` (upsert)."""
    case = await content_loader.upsert_case(session, case_in)
    await session.commit()
    await bump_content_version()
    await session.refresh(case, attribute_names=["options"])
    return _serialize_case_admin(case)


@router.delete("/cases/{slug}")
async def admin_delete_case(
    slug: str,
    hard: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Удаляет кейс: мягко (is_active=False) по умолчанию либо физически (hard)."""
    case = await session.scalar(select(Case).where(Case.slug == slug))
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Кейс не найден"
        )
    if hard:
        await session.delete(case)
    else:
        case.is_active = False
    await session.commit()
    await bump_content_version()
    return {"ok": True, "slug": slug, "hard": hard}


# ---------------------------------------------------------------------------
# Юниты и уроки
# ---------------------------------------------------------------------------
@router.get("/units")
async def admin_list_units(
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Список юнитов (для выбора при добавлении урока)."""
    units = (
        await session.scalars(select(Unit).order_by(Unit.order))
    ).all()
    return [
        {
            "id": u.id,
            "code": u.code,
            "codex": u.codex,
            "title": u.title,
            "is_active": u.is_active,
        }
        for u in units
    ]


@router.get("/lessons")
async def admin_list_lessons(
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Список уроков с числом карточек теории и вопросов."""
    lessons = (
        await session.scalars(
            select(LexBearLesson).order_by(
                LexBearLesson.unit_id, LexBearLesson.order
            )
        )
    ).all()
    out = []
    for lesson in lessons:
        n_cards = await session.scalar(
            select(func.count(TheoryCard.id)).where(
                TheoryCard.lesson_id == lesson.id
            )
        )
        n_questions = await session.scalar(
            select(func.count(Question.id)).where(
                Question.lesson_id == lesson.id
            )
        )
        out.append(
            {
                "id": lesson.id,
                "slug": lesson.slug,
                "unit_id": lesson.unit_id,
                "title": lesson.title,
                "order": lesson.order,
                "xp_reward": lesson.xp_reward,
                "is_active": lesson.is_active,
                "cards": n_cards,
                "questions": n_questions,
            }
        )
    return out


@router.put("/units/{unit_code}/lessons")
async def admin_upsert_lesson(
    unit_code: str,
    lesson_in: LessonIn,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Создаёт/обновляет урок (с теорией и вопросами) в юните ``unit_code``."""
    try:
        lesson = await content_loader.upsert_lesson(
            session, unit_code, lesson_in
        )
    except content_loader.UnitNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    await session.commit()
    await bump_content_version()
    return {
        "ok": True,
        "id": lesson.id,
        "slug": lesson.slug,
        "unit_code": unit_code,
    }


@router.delete("/lessons/{slug}")
async def admin_delete_lesson(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Мягко удаляет урок (is_active=False); прогресс сохраняется."""
    lesson = await session.scalar(
        select(LexBearLesson).where(LexBearLesson.slug == slug)
    )
    if lesson is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Урок не найден"
        )
    lesson.is_active = False
    await session.commit()
    await bump_content_version()
    return {"ok": True, "slug": slug}
