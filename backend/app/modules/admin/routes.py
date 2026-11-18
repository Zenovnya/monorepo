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

import uuid

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
from app.modules.learning import importer as learning_importer
from app.modules.learning.models import CaseVersion, LearningCase

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
# Адаптивный банк: импорт кейсов из паков и статус юридической проверки
# ---------------------------------------------------------------------------
@router.post("/reload-adaptive")
async def reload_adaptive(
    publish: bool = True,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Переносит кейсы в адаптивный банк (идемпотентно).

    Импортирует ДВА источника:
    1. ``cases.json`` — контент из репозитория;
    2. legacy-таблицу ``cases`` — то, что редактируется в веб-админке.

    Раньше импортировался только файл, поэтому кейс, созданный в админке, в
    адаптивный банк не попадал никогда.

    :param publish: публиковать ли кейсы. Юридическая проверка не меняется —
        ``review_status`` остаётся ``imported``.
    """
    try:
        pack_report = await learning_importer.import_cases(session, publish=publish)
        legacy_report = await learning_importer.import_legacy_cases(
            session, publish=publish
        )
    except learning_importer.ContentImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    await session.commit()
    await bump_content_version()
    return {
        "ok": True,
        "publish": publish,
        "report": pack_report,
        "report_legacy": legacy_report,
    }


@router.get("/adaptive/review")
async def adaptive_review_queue(
    review_status: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Список кейсов адаптивного банка со статусом юридической проверки."""
    query = (
        select(CaseVersion)
        .where(CaseVersion.source_slug.is_not(None))
        .order_by(CaseVersion.review_status, CaseVersion.source_slug)
    )
    if review_status:
        query = query.where(CaseVersion.review_status == review_status)
    versions = (await session.scalars(query)).all()
    return [
        {
            "slug": v.source_slug,
            "title": (await session.get(LearningCase, v.case_id)).title,
            "status": v.status,
            "review_status": v.review_status,
            "reviewed_by": v.reviewed_by,
            "reviewed_at": v.reviewed_at.isoformat() if v.reviewed_at else None,
        }
        for v in versions
    ]


@router.get("/adaptive/review/summary")
async def adaptive_review_summary(
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Сколько кейсов реально видит пользователь.

    Пользователю показываются только кейсы со статусом ``approved``
    (см. ``learning.service.PUBLISHED_REVIEW_STATUS``). Сразу после импорта у
    всех кейсов статус ``imported``, то есть адаптивная лента пуста — и без
    этой сводки это выглядит как поломка ленты, а не как «контент ещё не
    проверили». Модератору нужно видеть цифры сразу.
    """
    rows = (
        await session.execute(
            select(CaseVersion.review_status, CaseVersion.status)
        )
    ).all()
    by_status: dict[str, int] = {}
    visible = 0
    for review, publish_state in rows:
        by_status[review] = by_status.get(review, 0) + 1
        if review == "approved" and publish_state == "published":
            visible += 1
    return {
        "total": len(rows),
        "by_review_status": by_status,
        "visible_to_users": visible,
        "hidden_by_review": len(rows) - visible,
    }


@router.post("/adaptive/review/{slug}")
async def adaptive_set_review(
    slug: str,
    review_status: str,
    reviewed_by: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Меняет статус юридической проверки кейса: ``in_review`` или ``approved``.

    Недопустимый статус — это ошибка запроса (``422``), а не «кейс не найден».
    Раньше оба случая отдавали ``404``, и модератор с опечаткой в статусе шёл
    искать несуществующий кейс вместо того, чтобы исправить параметр.
    """
    if review_status not in learning_importer.REVIEW_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Недопустимый статус проверки. Допустимые: "
                + ", ".join(learning_importer.REVIEW_STATUSES)
            ),
        )
    try:
        version = await learning_importer.set_review_status(
            session, slug, review_status, reviewed_by=reviewed_by
        )
    except learning_importer.ContentImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    await session.commit()
    return {
        "ok": True,
        "slug": slug,
        "review_status": version.review_status,
        "reviewed_by": version.reviewed_by,
    }


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
        "hint": case.hint,
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
    """Создаёт или обновляет кейс по ``slug`` (upsert).

    Кроме legacy-таблицы (вкладка «Кейсы») кейс сразу зеркалится в адаптивный
    банк. Раньше это требовало отдельного вызова ``/reload-adaptive``, который
    к тому же перечитывал только ``cases.json`` с диска — сохранённый в админке
    кейс не попадал в ``/learning/next`` и диагностику никогда.
    """
    case = await content_loader.upsert_case(session, case_in)
    await session.commit()
    await bump_content_version()

    adaptive_report: dict | None = None
    try:
        adaptive_report = await learning_importer.import_legacy_cases(
            session, publish=True
        )
        await session.commit()
    except learning_importer.ContentImportError as exc:
        # Кейс уже сохранён в legacy — не откатываем его из-за проблем
        # адаптивного импорта, но сообщаем клиенту, что банк не обновлён.
        await session.rollback()
        adaptive_report = {"error": str(exc)}

    await session.refresh(case, attribute_names=["options"])
    payload = _serialize_case_admin(case)
    payload["adaptive"] = adaptive_report
    return payload


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
    units = (await session.scalars(select(Unit).order_by(Unit.order))).all()
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
            select(LexBearLesson).order_by(LexBearLesson.unit_id, LexBearLesson.order)
        )
    ).all()
    out = []
    for lesson in lessons:
        n_cards = await session.scalar(
            select(func.count(TheoryCard.id)).where(TheoryCard.lesson_id == lesson.id)
        )
        n_questions = await session.scalar(
            select(func.count(Question.id)).where(Question.lesson_id == lesson.id)
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
        lesson = await content_loader.upsert_lesson(session, unit_code, lesson_in)
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


@router.post("/notifications/dispatch")
async def admin_dispatch_notifications(
    user_id: uuid.UUID | None = None,
    dry_run: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Запускает рассылку напоминаний (стрик, цель дня, повторения).

    Планировщика в проекте нет, поэтому запуск идёт из cron/Railway Scheduled
    Jobs: ``curl -X POST .../admin/content/notifications/dispatch -H "X-Admin-Token: ..."``.
    Рассылка идемпотентна на уровне БД (user_id, type, day) — повторный запуск
    в тот же день не отправит дубли даже при двух воркерах.

    ``dry_run=true`` возвращает только план, ничего не отправляя.
    """
    from app.modules.notifications import dispatch

    return await dispatch.dispatch_reminders(
        session, user_id=user_id, dry_run=dry_run
    )
