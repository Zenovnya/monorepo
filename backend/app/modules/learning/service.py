import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.learning.constants import (
    PUBLISHED_REVIEW_STATUS as _PUBLISHED_REVIEW_STATUS,
)
from app.modules.learning.models import (
    AssessmentSession, Attempt, CaseAnswer, CaseCompetency, CaseStep,
    CaseVersion, LearningCase, UserCompetencyState,
)


class LearningError(Exception):
    pass


def new_competency_state(
    user_id: uuid.UUID,
    competency_id: uuid.UUID,
) -> UserCompetencyState:
    """Create an immediately usable state without relying on flush-time defaults."""
    return UserCompetencyState(
        user_id=user_id,
        competency_id=competency_id,
        mastery=0.0,
        confidence=0.0,
        attempts=0,
        correct_count=0,
    )


# Кейс попадает пользователю только с этим статусом юридической проверки.
# Импорт из JSON-паков или админки ставит ``imported`` — то есть «загружено,
# но юристом не проверено». Значение живёт в ``learning/constants.py``, чтобы
# его могли импортировать ``content.review_gate`` и ``progress.service`` без
# циклического импорта.
#
# Почему гейт, а не фильтр «показывать всё, кроме отклонённого»: статусов три
# (imported / in_review / approved), и по умолчанию кейс именно ``imported``.
# Белый список означает, что новая стадия проверки по умолчанию не пропускает
# контент, а не наоборот.
PUBLISHED_REVIEW_STATUS = _PUBLISHED_REVIEW_STATUS


def is_user_visible(version: CaseVersion) -> bool:
    """Можно ли показывать версию кейса пользователю."""
    return version.review_status == PUBLISHED_REVIEW_STATUS


def adaptive_score(weakness: float, difficulty: float) -> float:
    """Deterministic, explainable baseline score used by the MVP ranker."""
    return 0.65 * weakness + 0.25 * (1 - difficulty) + 0.10


async def _case_payload(session: AsyncSession, version: CaseVersion):
    step = (await session.execute(select(CaseStep).where(CaseStep.case_version_id == version.id).order_by(CaseStep.position))).scalars().first()
    if not step:
        return None
    answers = (await session.execute(select(CaseAnswer).where(CaseAnswer.step_id == step.id))).scalars().all()
    return {"case_version_id": version.id, "step_id": step.id, "situation": version.situation,
            "prompt": step.prompt, "answers": [{"id": a.id, "text": a.text} for a in answers],
            "difficulty": version.difficulty}


async def next_case(session: AsyncSession, user_id: uuid.UUID, exclude: set[uuid.UUID] | None = None):
    exclude = exclude or set()
    versions = (await session.execute(
        select(CaseVersion)
        .join(LearningCase)
        .where(
            CaseVersion.status == "published",
            LearningCase.status == "published",
            # Только проверенные юристом кейсы. Иначе адаптивная лента и
            # диагностика учат по непроверенному тексту.
            CaseVersion.review_status == PUBLISHED_REVIEW_STATUS,
        )
        .order_by(CaseVersion.difficulty)
    )).scalars().all()
    if not versions:
        return None
    states = (await session.execute(select(UserCompetencyState).where(UserCompetencyState.user_id == user_id))).scalars().all()
    state_map = {s.competency_id: s for s in states}

    # Связи «версия → компетенция» тянем ОДНИМ запросом. Раньше они выбирались
    # в цикле по каждой версии, и на 100 опубликованных кейсов это давало 100
    # отдельных SELECT-ов на каждый вызов /learning/next (классический N+1),
    # из-за чего экран «Учёба» заметно тормозил при загрузке.
    candidates = [v for v in versions if v.id not in exclude]
    links_by_version: dict[uuid.UUID, list[CaseCompetency]] = {}
    if candidates:
        link_rows = (await session.execute(
            select(CaseCompetency).where(
                CaseCompetency.case_version_id.in_([v.id for v in candidates])
            )
        )).scalars().all()
        for link in link_rows:
            links_by_version.setdefault(link.case_version_id, []).append(link)

    scored = []
    for version in candidates:
        links = links_by_version.get(version.id, [])
        weakness = sum((1 - (state_map[link.competency_id].mastery if link.competency_id in state_map else 0.0)) * link.weight for link in links)
        score = adaptive_score(weakness, version.difficulty)
        scored.append((score, version))
    return await _case_payload(session, max(scored, key=lambda item: item[0])[1]) if scored else None


async def next_assessment_case(session: AsyncSession, user_id: uuid.UUID, session_id: uuid.UUID):
    """Return an unanswered diagnostic case and close the session when exhausted."""
    assessment = await session.get(AssessmentSession, session_id)
    if assessment is None or assessment.user_id != user_id or assessment.completed:
        raise LearningError("Недействительная assessment-сессия")
    answered = (await session.execute(
        select(Attempt.case_version_id).where(Attempt.user_id == user_id, Attempt.assessment_session_id == session_id)
    )).scalars().all()
    case = await next_case(session, user_id, set(answered))
    if case is None:
        assessment.completed = True
        await session.flush()
    return case


async def evaluate(session: AsyncSession, user_id: uuid.UUID, data):
    if data.assessment_session_id is not None:
        assessment = await session.get(AssessmentSession, data.assessment_session_id)
        if assessment is None or assessment.user_id != user_id or assessment.completed:
            raise LearningError("Недействительная assessment-сессия")
    version = await session.get(CaseVersion, data.case_version_id)
    step = await session.get(CaseStep, data.step_id)
    answer = await session.get(CaseAnswer, data.answer_id)
    if not version or version.status != "published" or not step or step.case_version_id != version.id or not answer or answer.step_id != step.id:
        raise LearningError("Кейс, шаг и ответ не соответствуют друг другу")
    # Ответ на непроверенный кейс отклоняем не «на всякий случай»: иначе
    # клиент, сохранивший id версии до перевода в in_review, продолжал бы
    # писать попытки по снятому с показа контенту.
    if not is_user_visible(version):
        raise LearningError("Кейс ещё не прошёл юридическую проверку")
    if data.assessment_session_id is not None:
        existing = (await session.execute(select(Attempt).where(
            Attempt.user_id == user_id,
            Attempt.assessment_session_id == data.assessment_session_id,
            Attempt.case_version_id == version.id,
            Attempt.step_id == step.id,
        ))).scalars().first()
        if existing:
            return {"attempt_id": existing.id, "correct": existing.correct,
                    "error_type": existing.error_type, "explanation": answer.explanation,
                    "mastery_updates": {}}
    attempt = Attempt(user_id=user_id, case_version_id=version.id, step_id=step.id, answer_id=answer.id,
                     assessment_session_id=data.assessment_session_id, correct=answer.is_correct,
                     error_type=None if answer.is_correct else answer.error_type,
                     time_spent_seconds=data.time_spent_seconds, hints_used=data.hints_used)
    session.add(attempt)
    links = (await session.execute(select(CaseCompetency).where(CaseCompetency.case_version_id == version.id))).scalars().all()
    updates = {}
    for link in links:
        state = (await session.execute(select(UserCompetencyState).where(UserCompetencyState.user_id == user_id, UserCompetencyState.competency_id == link.competency_id))).scalars().first()
        if not state:
            state = new_competency_state(user_id, link.competency_id)
            session.add(state)
        state.attempts += 1
        state.correct_count += int(answer.is_correct)
        state.mastery = max(0.0, min(1.0, state.mastery + (0.12 if answer.is_correct else -0.08) * link.weight))
        state.confidence = min(1.0, state.attempts / 5)
        state.last_seen = datetime.now(timezone.utc)
        updates[link.competency_id] = round(state.mastery, 4)
    return {"attempt_id": attempt.id, "correct": answer.is_correct, "error_type": attempt.error_type,
            "explanation": answer.explanation, "mastery_updates": updates}


async def unavailable_reason(session: AsyncSession) -> str | None:
    """Почему пользователю нечего показать (``None`` — кейсы есть).

    Без этого пустая выдача неотличима от сбоя: клиент показывал «все кейсы
    пройдены» даже когда в банке не было ни одного проверенного кейса. Это
    ложное достижение — пользователь считает, что всё выучил, хотя не увидел
    ни одного разбора.
    """
    published = (await session.execute(
        select(CaseVersion.id).where(
            CaseVersion.status == "published",
            LearningCase.status == "published",
        ).join(LearningCase)
    )).scalars().all()
    if not published:
        return "no_content"
    approved = (await session.execute(
        select(CaseVersion.id).where(
            CaseVersion.status == "published",
            LearningCase.status == "published",
            CaseVersion.review_status == PUBLISHED_REVIEW_STATUS,
        ).join(LearningCase)
    )).scalars().all()
    if not approved:
        return "awaiting_review"
    return None


async def start_assessment(session: AsyncSession, user_id: uuid.UUID):
    assessment = AssessmentSession(user_id=user_id)
    session.add(assessment)
    await session.flush()
    return assessment, await next_case(session, user_id)