import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.learning import service
from app.modules.learning.models import UserCompetencyState
from app.modules.learning.schemas import AttemptCreate, AttemptResult, AssessmentStart, CaseRead, CompetencyProgress

router = APIRouter(prefix="/learning", tags=["learning"])


def user_id(authorization: str = Depends(auth_service.get_bearer_token)) -> uuid.UUID:
    try:
        return auth_service.decode_access_token(authorization)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/assessment/start", response_model=AssessmentStart)
async def assessment_start(uid: uuid.UUID = Depends(user_id), session: AsyncSession = Depends(get_session)):
    assessment, case = await service.start_assessment(session, uid)
    await session.commit()
    return {"session_id": assessment.id, "case": case}


@router.get("/assessment/next", response_model=CaseRead | None)
async def assessment_next(session_id: uuid.UUID, uid: uuid.UUID = Depends(user_id), session: AsyncSession = Depends(get_session)):
    """Returns the next diagnostic item without exposing answer correctness."""
    try:
        return await service.next_assessment_case(session, uid, session_id)
    except service.LearningError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/assessment/answer", response_model=AttemptResult)
async def assessment_answer(data: AttemptCreate, uid: uuid.UUID = Depends(user_id), session: AsyncSession = Depends(get_session)):
    """Evaluates a diagnostic answer through the same trusted server-side engine."""
    if data.assessment_session_id is None:
        raise HTTPException(status_code=400, detail="assessment_session_id обязателен")
    try:
        result = await service.evaluate(session, uid, data)
    except service.LearningError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await session.commit()
    return result


@router.get("/next", response_model=CaseRead | None)
async def learning_next(
    exclude: str | None = Query(
        default=None,
        description=(
            "Кейсы, которые клиент уже прошёл в текущей сессии: "
            "UUID через запятую. Без исключений ранжирование детерминировано "
            "и всегда возвращает один и тот же кейс."
        ),
    ),
    uid: uuid.UUID = Depends(user_id),
    session: AsyncSession = Depends(get_session),
):
    seen: set[uuid.UUID] = set()
    for chunk in (exclude or "").split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            seen.add(uuid.UUID(chunk))
        except ValueError:
            # Мусор в query-параметре не должен ронять выдачу: пропускаем.
            continue
    return await service.next_case(session, uid, exclude=seen)


@router.post("/attempts", response_model=AttemptResult)
async def learning_attempt(data: AttemptCreate, uid: uuid.UUID = Depends(user_id), session: AsyncSession = Depends(get_session)):
    try:
        result = await service.evaluate(session, uid, data)
    except service.LearningError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await session.commit()
    return result


@router.get("/progress", response_model=list[CompetencyProgress])
async def learning_progress(uid: uuid.UUID = Depends(user_id), session: AsyncSession = Depends(get_session)):
    states = (await session.execute(select(UserCompetencyState).where(UserCompetencyState.user_id == uid))).scalars().all()
    return states