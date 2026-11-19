"""HTTP-ручки адаптивного обучения.

Разделение, которое здесь важно: ``/next`` **сам выдаёт карточку** и открывает
попытку. Отдельной ручки «открой вот эту карточку в режиме fresh_case» нет —
иначе клиент назначал бы себе засчитываемую попытку на уже показанный разбор.

``sandbox`` включает черновой контент и доступен только администратору:
это режим проверки новых карточек, а не «показать всё всем».
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.adaptive import service
from app.modules.adaptive.schemas import (
    ActionResultRead,
    AttemptOpenRead,
    MetadataRead,
    NextRead,
    OpenRequest,
    ActionRequest,
    OverviewRead,
)
from app.modules.admin.security import require_admin
from app.modules.auth import service as auth_service

router = APIRouter(prefix="/adaptive", tags=["adaptive"])


def user_id(authorization: str = Depends(auth_service.get_bearer_token)) -> uuid.UUID:
    try:
        return auth_service.decode_access_token(authorization)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


async def require_admin_optional(x_admin_token: str | None = Header(default=None)) -> str | None:
    """Мягкая проверка админ-токена: без него работает обычный режим.

    Нужна только для ``sandbox``: ученик с валидным JWT не должен получать
    ошибку из-за отсутствия админского заголовка.
    """
    if not x_admin_token:
        return None
    try:
        await require_admin(x_admin_token)
    except HTTPException:
        return None
    return x_admin_token


def _fail(exc: service.AdaptiveError) -> HTTPException:
    # Код ошибки уходит клиенту как есть: экран по нему решает, что показать
    # («контент недоступен» ≠ «попытка уже открыта»).
    return HTTPException(status_code=exc.status_code, detail=exc.code)


@router.get("", response_model=MetadataRead)
async def metadata(
    uid: uuid.UUID = Depends(user_id), session: AsyncSession = Depends(get_session)
) -> dict:
    """Список тем и служебная пометка о редакционном статусе контента."""
    return await service.start(session, uid)


@router.get("/next", response_model=NextRead)
async def next_case(
    topic_id: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    open_attempt: bool = Query(default=True),
    sandbox: bool = Query(default=False),
    uid: uuid.UUID = Depends(user_id),
    session: AsyncSession = Depends(get_session),
    _admin: str | None = Depends(require_admin_optional),
) -> dict:
    """Следующий кейс по решению сервера."""
    try:
        return await service.choose_next(
            session,
            uid,
            topic_id=topic_id,
            lesson_id=lesson_id,
            open_attempt=open_attempt,
            sandbox=sandbox and _admin is not None,
        )
    except service.AdaptiveError as exc:
        raise _fail(exc) from exc


@router.get("/overview", response_model=OverviewRead)
async def overview(
    uid: uuid.UUID = Depends(user_id), session: AsyncSession = Depends(get_session)
) -> dict:
    """Прогресс по темам: приоритет практики, а не «процент знаний»."""
    return await service.overview(session, uid)


@router.get("/lessons/{lesson_id}")
async def lesson(
    lesson_id: str,
    uid: uuid.UUID = Depends(user_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Учебный экран урока: теория и шаги."""
    try:
        return await service.lesson(session, uid, lesson_id)
    except service.AdaptiveError as exc:
        raise _fail(exc) from exc


@router.post("/attempts", response_model=AttemptOpenRead)
async def open_attempt(
    data: OpenRequest,
    uid: uuid.UUID = Depends(user_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Открыть повтор уже виденного кейса (или практику по разбору)."""
    if data.origin == "auto":
        # Автоматическую выдачу делает только /next.
        raise HTTPException(status_code=400, detail="BAD_ORIGIN")
    try:
        return await service.open_attempt(
            session, uid, data.item_id, mode=data.mode, origin=data.origin
        )
    except service.AdaptiveError as exc:
        raise _fail(exc) from exc


@router.post("/attempts/{attempt_id}/actions", response_model=ActionResultRead)
async def act(
    attempt_id: str,
    data: ActionRequest,
    uid: uuid.UUID = Depends(user_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Ответ, подсказка, пропуск или показ разбора."""
    try:
        return await service.answer(
            session, uid, attempt_id, data.action, data.option_id
        )
    except service.AdaptiveError as exc:
        raise _fail(exc) from exc
