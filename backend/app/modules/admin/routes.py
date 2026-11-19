"""Служебные (admin) роуты управления контентом.

Защищены admin-токеном (``X-Admin-Token``) и предназначены для внутренней
веб-админки и деплой-скриптов, а не для мобильных клиентов.

С 0026 контент поставляется одним файлом (``app/content_packs/themes.json``):
он проверяется на импорте и отдаётся движком. Поэтому здесь не «пишем уроки в
БД», а **читаем и проверяем пак** — правки контента делаются в файле, а не в
таблицах, иначе две копии контента неизбежно разъедутся.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.admin.security import require_admin
from app.modules.content.validation import CaseIn, LessonIn
from app.modules.adaptive import engine
from app.modules.adaptive.errors import EngineError
from app.modules.adaptive.pack import get_pack, load_pack, validate

router = APIRouter(
    prefix="/admin/content",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


# --- Пакет тем -------------------------------------------------------------


@router.get("/pack")
async def pack_summary() -> dict:
    """Сводка по опубликованному паку: темы, уроки, карточки, нормы."""
    pack = get_pack()
    return {
        "ok": True,
        "release_key": pack.release_key,
        "editorial_note": pack.editorial_note,
        "topics": len(pack.topics),
        "lessons": len(pack.lessons),
        "items": len(pack.items),
        "legal_authorities": len(pack.authorities),
        "algorithm_version": pack.algorithm.get("version"),
    }


@router.get("/pack/structure")
async def pack_structure() -> dict:
    """Структура пака: темы с уроками второго уровня.

    Отдельная ручка, а не расширение ``/pack``: сводка нужна деплой-скриптам и
    должна оставаться короткой, а эта — для страницы админки. Данные берутся из
    того же загруженного пака, поэтому расхождению с содержимым взяться неоткуда.
    """
    pack = get_pack()
    topics = []
    for topic_id, topic in pack.topics.items():
        lessons = pack.lessons_of(topic_id)
        topics.append(
            {
                "topic_id": topic_id,
                "title": topic["title"],
                "order": topic["order"],
                "weight_pct": topic.get("weight_pct"),
                "summary": topic.get("summary"),
                "lessons": [
                    {
                        "lesson_id": lesson["id"],
                        "order": lesson["order"],
                        "title": lesson["title"],
                        "short_title": lesson.get("short_title") or lesson["title"],
                        "goal": lesson["goal"],
                        "legal_review_status": lesson["legal_review_status"],
                        "control_item_id": lesson["control_id"],
                    }
                    for lesson in lessons
                ],
            }
        )
    topics.sort(key=lambda row: row["order"])
    return {
        "ok": True,
        "release_key": pack.release_key,
        "topics": topics,
    }


@router.post("/pack/validate")
async def validate_pack() -> dict:
    """Проверяет пак по тем же правилам, что и импорт.

    Нужен, чтобы ошибку в контенте нашли здесь, а не пользователь: битый пак
    не должен доехать до экрана «кейс не открывается».
    """
    pack = load_pack()
    try:
        validate(pack)
    except EngineError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"ok": True, "release_key": pack.release_key}


@router.get("/pack/{lesson_id}")
async def lesson_preview(lesson_id: str) -> dict:
    """Учебный экран урока — то же, что видит пользователь."""
    pack = get_pack()
    if lesson_id not in pack.lessons:
        raise HTTPException(status_code=404, detail="UNKNOWN_LESSON")
    return engine.lesson_payload(pack, lesson_id)


# --- Проверки ввода для формы редактирования ------------------------------


@router.post("/validate/case")
async def validate_case(data: CaseIn) -> dict:
    """Проверяет кейс из формы, не записывая его.

    Схема ``CaseIn`` уже отказывает нерешаемому кейсу (нет правильного варианта
    или их два) — здесь она просто доступна как отдельная ручка, чтобы форма
    могла показать ошибку до сохранения.
    """
    return {"ok": True, "slug": data.slug, "options": len(data.options)}


@router.post("/validate/lesson")
async def validate_lesson(data: LessonIn) -> dict:
    """Проверяет урок с вопросами из формы, не записывая его."""
    return {"ok": True, "slug": data.slug, "questions": len(data.questions)}


@router.get("/status")
async def content_status() -> dict:
    """Короткий ответ «контент есть и он валиден» для деплой-скриптов."""
    pack = get_pack()
    try:
        validate(pack)
    except EngineError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    return {"ok": True, "release_key": pack.release_key}
