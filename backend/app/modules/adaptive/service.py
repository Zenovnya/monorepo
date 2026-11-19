"""Связывает движок отбора с базой.

Правило, ради которого этот слой отдельный: **клиент не выбирает, что ему
показать**. Он просит «следующий кейс», а режим и источник выдачи определяет
сервер — иначе клиент выдал бы себе ``fresh_case`` на уже показанную карточку
и получил засчитанное наблюдение за просмотренный разбор.

Ещё две вещи живут здесь, а не в движке:

* блокировка пользователя (``SELECT ... FOR UPDATE``), чтобы две вкладки не
  открыли две попытки одновременно;
* снимок приоритетов темы, чтобы на экране прогресса были те же числа, по
  которым шёл выбор.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.adaptive import constants as c
from app.modules.auth.models import User
from app.modules.adaptive.constants import XP_PER_COUNTED_ANSWER
from app.modules.adaptive import engine
from app.modules.adaptive.errors import EngineError
from app.modules.adaptive.models import (
    AdaptiveAttempt,
    AdaptiveObservation,
    AdaptiveSeenFamily,
    AdaptiveState,
    AdaptiveTopicPriority,
    sync_weights,
    to_engine_state,
)
from app.modules.adaptive.pack import Pack, get_pack

__all__ = [
    "AdaptiveError",
    "answer",
    "choose_next",
    "lesson",
    "open_attempt",
    "overview",
    "start",
    "state_payload",
]


class AdaptiveError(Exception):
    """Ошибка с кодом и HTTP-статусом, чтобы роутер не угадывал."""

    def __init__(self, code: str, status_code: int = 400) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code


# Коды движка, которые означают «неверный запрос клиента», а не сбой.
_BAD_REQUEST = {
    "OPEN_ATTEMPT",
    "UNKNOWN_ITEM",
    "UNKNOWN_ATTEMPT",
    "UNKNOWN_TOPIC",
    "UNKNOWN_LESSON",
    "AMBIGUOUS_CHOICE",
    "WRONG_MODE",
    "BAD_ORIGIN",
    "BAD_OPTION",
    "BAD_ACTION",
    "NOT_OPEN",
}
_CONFLICT = {"FAMILY_SEEN", "CONTENT_UNAVAILABLE"}
_NOT_FOUND = {"UNKNOWN_ITEM", "UNKNOWN_ATTEMPT", "UNKNOWN_TOPIC", "UNKNOWN_LESSON"}


def _translate(exc: EngineError) -> AdaptiveError:
    code = str(exc)
    if code in _NOT_FOUND:
        return AdaptiveError(code, 404)
    if code in _CONFLICT:
        return AdaptiveError(code, 409)
    if code in _BAD_REQUEST:
        return AdaptiveError(code, 400)
    return AdaptiveError(code, 500)


# --- Загрузка и сохранение состояния --------------------------------------


# Сериализует все сценарии записи состояния одного пользователя.
# asyncio.Lock в одном процессе гарантирует, что параллельные запросы
# (нажатие «Ответить» + повторный рендер, StrictMode, две вкладки)
# не увидят одно и то же состояние одновременно: каждый следующий
# запрос выполнится после предыдущего на свежем состоянии. Это
# устраняет гонку уникальности до того, как она дойдёт до IntegrityError.
_write_locks: dict[uuid.UUID, asyncio.Lock] = {}
_write_locks_guard = asyncio.Lock()


async def _acquire_write_lock(user_id: uuid.UUID) -> asyncio.Lock:
    lock = _write_locks.get(user_id)
    if lock is None:
        async with _write_locks_guard:
            lock = _write_locks.get(user_id)
            if lock is None:
                lock = asyncio.Lock()
                _write_locks[user_id] = lock
    return lock


async def _run_write(
    session: AsyncSession,
    fn,
    *args: Any,
    **kwargs: Any,
) -> Any:
    """Запускает сценарий записи с сериализацией и одним повтором при конфликте.

    Сериализация (``asyncio.Lock`` по пользователю) устраняет гонку
    уникальности ещё до того, как она достигнет базы: параллельные
    запросы (нажатие «Ответить» + повторный рендер, StrictMode, две
    вкладки) не могут прочитать одно и то же состояние одновременно —
    каждый следующий запрос выполняется после предыдущего на свежем
    состоянии. Если на SQLite всё же возникает ``IntegrityError``
    (например, из-за двух процессов), повтор запускает сценарий на
    новом состоянии: на свежем состоянии он видит чужие изменения и
    завершается корректно (попытка уже закрыта — returns ``already_closed``).
    """
    lock = await _acquire_write_lock(kwargs.pop("_user_id", None))
    async with lock:
        for attempt in range(2):
            try:
                return await fn(session, *args, **kwargs)
            except IntegrityError:
                await session.rollback()
                if attempt == 1:
                    raise
        raise RuntimeError("unreachable")  # pragma: no cover


async def _load(
    session: AsyncSession, user_id: uuid.UUID, *, lock: bool = False
) -> tuple[AdaptiveState, engine.State, Pack]:
    """Читает состояние пользователя и восстанавливает его для движка."""
    pack = get_pack()
    statement = select(AdaptiveState).where(AdaptiveState.user_id == user_id)
    if lock:
        # Две вкладки не должны открыть две попытки: строки состояния
        # блокируются до конца транзакции.
        statement = statement.with_for_update()
    root = await session.scalar(statement)
    if root is None:
        root = AdaptiveState(
            user_id=user_id, release_key=pack.release_key, weights={}, seq=0
        )
        session.add(root)
        try:
            await session.flush()
        except IntegrityError:
            # Гонка: два парных запроса (нажатие кнопки + повторный рендер,
            # StrictMode) оба видят «статьи нет» и оба пытаются создать строку
            # состояния. Без этого IntegrityError уходил в 500, и клиент
            # показывал «Сервер не смог отдать проверку. Мы уже разбираемся»,
            # хотя всё было в порядке — просто второй запрос проиграл гонку.
            # Откатываем только создание строки и перечитываем: другая
            # транзакция уже сделала то, что нужно.
            await session.rollback()
            root = await session.scalar(statement)
            if root is None:
                raise

    if root.release_key != pack.release_key:
        # Пак обновился. История остаётся, но открытая попытка могла ссылаться
        # на карточку, которой больше нет — её закроет cancel_obsolete.
        root.release_key = pack.release_key
    sync_weights(root, pack.topics)

    attempts = list(
        (
            await session.scalars(
                select(AdaptiveAttempt).where(AdaptiveAttempt.user_id == user_id)
            )
        ).all()
    )
    observations = list(
        (
            await session.scalars(
                select(AdaptiveObservation).where(AdaptiveObservation.user_id == user_id)
            )
        ).all()
    )
    seen = list(
        (
            await session.scalars(
                select(AdaptiveSeenFamily).where(AdaptiveSeenFamily.user_id == user_id)
            )
        ).all()
    )
    state = to_engine_state(root, attempts, observations, seen)
    # Без этого id попытки снова стал бы `a{seq}` и столкнулся бы с чужим
    # первичным ключом. Префикс стабилен: он от id пользователя.
    state.user_key = user_id.hex
    return root, state, pack


async def _save(
    session: AsyncSession,
    root: AdaptiveState,
    state: engine.State,
    before: dict[str, Any],
) -> None:
    """Пишет только то, что изменилось.

    Сравнивать состояние «до» дешевле, чем переписывать историю целиком на
    каждый ответ: у активного ученика это сотни строк.
    """
    root.seq = state.seq
    root.open_attempt_id = state.open_attempt_id

    known_attempts = set(before["attempts"])
    for attempt_id, attempt in state.attempts.items():
        if attempt_id in known_attempts:
            row = before["attempts"][attempt_id]
            if (
                row.status != attempt.status
                or row.assisted != attempt.assisted
                or row.counted != attempt.counted
                or row.reason != attempt.reason
                or row.terminal_seq != attempt.terminal_seq
                or row.correct != attempt.correct
                or row.selected_option_id != attempt.selected_option_id
            ):
                row.status = attempt.status
                row.assisted = attempt.assisted
                row.counted = attempt.counted
                row.reason = attempt.reason
                row.terminal_seq = attempt.terminal_seq
                row.correct = attempt.correct
                row.selected_option_id = attempt.selected_option_id
            continue
        session.add(
            AdaptiveAttempt(
                id=attempt.id,
                user_id=root.user_id,
                item_id=attempt.item_id,
                lesson_id=_lesson_of(attempt.item_id),
                topic_id=attempt.topic_id,
                subtopic_id=attempt.subtopic_id,
                evidence_family_id=attempt.evidence_family_id,
                content_version=attempt.content_version,
                mode=attempt.mode,
                origin=attempt.origin,
                issued_seq=attempt.issued_seq,
                terminal_seq=attempt.terminal_seq,
                preexposed=attempt.preexposed,
                assisted=attempt.assisted,
                status=attempt.status,
                counted=attempt.counted,
                reason=attempt.reason,
                selected_option_id=attempt.selected_option_id,
                correct=attempt.correct,
            )
        )

    known_seen = set(before["seen"])
    for family in state.seen_families:
        if family not in known_seen:
            session.add(AdaptiveSeenFamily(user_id=root.user_id, family_id=family))

    known_observations = set(before["observations"])
    for observation in state.observations:
        if observation.attempt_id in known_observations:
            row = before["observations"][observation.attempt_id]
            if row.voided != observation.voided:
                row.voided = observation.voided
            continue
        session.add(
            AdaptiveObservation(
                user_id=root.user_id,
                attempt_id=observation.attempt_id,
                seq=observation.seq,
                topic_id=observation.topic_id,
                subtopic_id=observation.subtopic_id,
                item_id=observation.item_id,
                evidence_family_id=observation.evidence_family_id,
                content_version=observation.content_version,
                correct=observation.correct,
                voided=observation.voided,
            )
        )
    await session.flush()


def _lesson_of(item_id: str) -> str:
    """``CIV01_R1`` → ``CIV01`` (у карточек всех типов суффикс ``_X``)."""
    return item_id.split("_", 1)[0]


async def _snapshot(session: AsyncSession, user_id: uuid.UUID) -> dict[str, Any]:
    attempts = {
        row.id: row
        for row in (
            await session.scalars(
                select(AdaptiveAttempt).where(AdaptiveAttempt.user_id == user_id)
            )
        ).all()
    }
    observations = {
        row.attempt_id: row
        for row in (
            await session.scalars(
                select(AdaptiveObservation).where(AdaptiveObservation.user_id == user_id)
            )
        ).all()
    }
    seen = {
        row.family_id
        for row in (
            await session.scalars(
                select(AdaptiveSeenFamily).where(AdaptiveSeenFamily.user_id == user_id)
            )
        ).all()
    }
    return {"attempts": attempts, "observations": observations, "seen": seen}


# --- Сценарии --------------------------------------------------------------


async def start(
    session: AsyncSession, user_id: uuid.UUID, *, sandbox: bool = False
) -> dict[str, Any]:
    """Гарантирует, что у пользователя есть состояние."""
    _root, _state, pack = await _load(session, user_id)
    return {
        "release_key": pack.release_key,
        "editorial_note": pack.editorial_note,
        "topics": [
            {
                "topic_id": topic_id,
                "title": topic["title"],
                "order": topic["order"],
                "lessons_total": len(pack.lessons_of(topic_id)),
            }
            for topic_id, topic in sorted(pack.topics.items(), key=lambda kv: kv[1]["order"])
        ],
    }


async def choose_next(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    topic_id: str | None = None,
    lesson_id: str | None = None,
    open_attempt: bool = True,
    sandbox: bool = False,
) -> dict[str, Any]:
    """Следующий кейс: выбор движка + выдача карточки без ответа.

    ``open_attempt=False`` — только спросить решение (экран темы), не занимая
    единственную открытую попытку.
    """
    return await _run_write(
        session,
        _choose_next,
        user_id,
        topic_id,
        lesson_id,
        open_attempt,
        sandbox,
        _user_id=user_id,
    )


async def _choose_next(
    session: AsyncSession,
    user_id: uuid.UUID,
    topic_id: str | None,
    lesson_id: str | None,
    open_attempt: bool,
    sandbox: bool,
) -> dict[str, Any]:
    root, state, pack = await _load(session, user_id, lock=True)
    before = await _snapshot(session, user_id)
    try:
        choice = engine.choose(
            pack,
            state,
            topic_id=topic_id,
            lesson_id=lesson_id,
            weights=sync_weights(root, pack.topics),
            sandbox=sandbox,
        )
    except EngineError as exc:
        raise _translate(exc) from exc

    payload: dict[str, Any] = {"choice": choice.as_dict()}
    attempt = None
    if choice.kind == c.CHOICE_NEW_CASE and open_attempt:
        try:
            attempt = engine.issue(
                pack,
                state,
                choice.item_id,
                mode=c.MODE_FRESH_CASE,
                origin=choice.origin or c.ORIGIN_MANUAL,
                sandbox=sandbox,
            )
        except EngineError as exc:
            raise _translate(exc) from exc
    elif choice.kind == c.CHOICE_REVIEW and open_attempt:
        # Повтор предлагается, но открывается только явным действием: иначе
        # повторная карточка закрыла бы единственную открытую попытку.
        attempt = None
    elif choice.kind == c.CHOICE_RESUME:
        attempt = state.attempts.get(choice.attempt_id or "")

    if attempt is not None and attempt.item_id in pack.items:
        payload["item"] = engine.public_item(pack, attempt.item_id)
        payload["attempt_id"] = attempt.id
        payload["mode"] = attempt.mode
        payload["origin"] = attempt.origin
    elif choice.kind == c.CHOICE_LESSON and choice.lesson_id:
        payload["lesson"] = engine.lesson_payload(pack, choice.lesson_id)
    elif choice.item_id and choice.item_id in pack.items:
        payload["preview"] = engine.public_item(pack, choice.item_id)

    await _save(session, root, state, before)
    await _refresh_priorities(session, root, state, pack)
    await session.commit()
    return payload


async def open_attempt(
    session: AsyncSession,
    user_id: uuid.UUID,
    item_id: str,
    *,
    mode: str,
    origin: str,
    sandbox: bool = False,
) -> dict[str, Any]:
    """Открывает попытку по уже выбранной карточке (например, повтор)."""
    return await _run_write(
        session,
        _open_attempt,
        user_id,
        item_id,
        mode,
        origin,
        sandbox,
        _user_id=user_id,
    )


async def _open_attempt(
    session: AsyncSession,
    user_id: uuid.UUID,
    item_id: str,
    mode: str,
    origin: str,
    sandbox: bool,
) -> dict[str, Any]:
    root, state, pack = await _load(session, user_id, lock=True)
    before = await _snapshot(session, user_id)
    try:
        attempt = engine.issue(
            pack, state, item_id, mode=mode, origin=origin, sandbox=sandbox
        )
    except EngineError as exc:
        raise _translate(exc) from exc
    await _save(session, root, state, before)
    await session.commit()
    return {
        "attempt_id": attempt.id,
        "mode": attempt.mode,
        "origin": attempt.origin,
        "item": engine.public_item(pack, attempt.item_id),
    }


async def answer(
    session: AsyncSession,
    user_id: uuid.UUID,
    attempt_id: str,
    action: str,
    option_id: str | None = None,
    *,
    sandbox: bool = False,
) -> dict[str, Any]:
    """Принимает ответ, подсказку, пропуск или показ разбора."""
    return await _run_write(
        session,
        _answer,
        user_id,
        attempt_id,
        action,
        option_id,
        sandbox,
        _user_id=user_id,
    )


async def _answer(
    session: AsyncSession,
    user_id: uuid.UUID,
    attempt_id: str,
    action: str,
    option_id: str | None,
    sandbox: bool,
) -> dict[str, Any]:
    root, state, pack = await _load(session, user_id, lock=True)
    if attempt_id not in state.attempts:
        # Попытка другого пользователя — то же, что несуществующая: не
        # подтверждаем клиенту, что такой id вообще бывает.
        raise AdaptiveError("UNKNOWN_ATTEMPT", 404)
    before = await _snapshot(session, user_id)
    try:
        result = engine.act(
            pack, state, attempt_id, action, option_id, sandbox=sandbox
        )
    except EngineError as exc:
        raise _translate(exc) from exc
    await _save(session, root, state, before)
    await _refresh_priorities(session, root, state, pack)

    xp_awarded = 0
    if result.get("counted") and result.get("correct") is True:
        # XP за зачтённый самостоятельный правильный ответ. Подсказка,
        # пропуск, разбор и повтор засчитываются — за них XP не даём: то есть
        # XP отражает именно самостоятельное решение.
        xp_awarded = XP_PER_COUNTED_ANSWER
        from app.modules.gamification import service as gamification_service

        user = await session.get(User, user_id)
        if user is not None:
            await gamification_service.add_xp(session, user, xp_awarded)

    await session.commit()

    result["attempt_id"] = attempt_id
    if xp_awarded:
        # Клиент показывает «+20 XP»: без этого XP начислился на сервере, а
        # на экране всё оставалось нулём, и выглядело это как «XP не
        # начисляется».
        result["xp_gained"] = xp_awarded
    if result.get("status") == "answered":
        # Разбор показывается после ответа — здесь и только здесь.
        item = pack.items[state.attempts[attempt_id].item_id]
        result["explanation"] = next(
            (
                option["explanation"]
                for option in item["options"]
                if option["id"] == result.get("correct_option_id")
            ),
            None,
        )
    return result


async def lesson(session: AsyncSession, user_id: uuid.UUID, lesson_id: str) -> dict[str, Any]:
    """Учебный экран урока: теория, шаги, разбор."""
    pack = get_pack()
    if lesson_id not in pack.lessons:
        raise AdaptiveError("UNKNOWN_LESSON", 404)
    resume = await session.scalar(
        select(AdaptiveState).where(AdaptiveState.user_id == user_id)
    )
    payload = engine.lesson_payload(pack, lesson_id)
    payload["open_attempt_id"] = resume.open_attempt_id if resume else None
    return payload


async def overview(
    session: AsyncSession, user_id: uuid.UUID, *, sandbox: bool = False
) -> dict[str, Any]:
    """Прогресс по темам: те же числа, по которым шёл выбор.

    ``need`` — **приоритет полезной практики**, а не процент правильных
    ответов: в интерфейсе так и подписано. Пустая тема выглядит «средней»
    (2/4), потому что про неё ничего не известно.
    """
    root, state, pack = await _load(session, user_id)
    weights = sync_weights(root, pack.topics)
    computed = engine.metrics(pack, state, weights)
    topics = []
    for topic_id, topic in sorted(pack.topics.items(), key=lambda kv: kv[1]["order"]):
        row = computed[topic_id]
        lessons = pack.lessons_of(topic_id)
        lesson_ids = {lesson["id"] for lesson in lessons}
        done = {
            _lesson_of(attempt.item_id)
            for attempt in state.attempts.values()
            if attempt.counted and _lesson_of(attempt.item_id) in lesson_ids
        }
        topics.append(
            {
                "topic_id": topic_id,
                "title": topic["title"],
                "order": topic["order"],
                "summary": topic.get("summary"),
                "focus": topic.get("focus"),
                "weight_pct": row.weight_pct,
                "n": row.n,
                "errors": row.errors,
                "correct_count": row.correct_count,
                "practice_priority": round(float(row.need) * 100, 1),
                # Настоящий прогресс темы — сколько уроков пройдено. Раньше
                # полоса показывала practice_priority: у темы без ответов он
                # начинался с 50 %, а после пары правильных ответов падал до
                # 25 % — то есть «прогресс» уменьшался по мере прохождения.
                "progress_pct": round(
                    len(done) / len(lessons) * 100, 1
                ) if lessons else 0.0,
                "priority": round(float(row.priority), 3),
                "state": row.state,
                "lessons_total": len(lessons),
                "lessons_practised": len(done),
                "lessons": [
                    {
                        "lesson_id": item["id"],
                        "title": item["title"],
                        "short_title": item.get("short_title") or item["title"],
                        "order": item["order"],
                        "goal": item["goal"],
                        "practised": item["id"] in done,
                    }
                    for item in lessons
                ],
            }
        )
    topics.sort(key=lambda row: (-row["priority"], row["order"]))
    return {
        "release_key": pack.release_key,
        "editorial_note": pack.editorial_note,
        "open_attempt_id": state.open_attempt_id,
        "topics": topics,
        "recent": [
            {
                "seq": observation.seq,
                "topic_id": observation.topic_id,
                "item_id": observation.item_id,
                "correct": observation.correct,
                "voided": observation.voided,
            }
            for observation in sorted(state.observations, key=lambda o: o.seq)[-10:][::-1]
        ],
    }


async def _refresh_priorities(
    session: AsyncSession, root: AdaptiveState, state: engine.State, pack: Pack
) -> None:
    """Обновляет снимок приоритетов тем (для экрана прогресса)."""
    computed = engine.metrics(pack, state, sync_weights(root, pack.topics))
    existing = {
        row.topic_id: row
        for row in (
            await session.scalars(
                select(AdaptiveTopicPriority).where(
                    AdaptiveTopicPriority.user_id == root.user_id
                )
            )
        ).all()
    }
    for topic_id, row in computed.items():
        stored = existing.get(topic_id)
        if stored is None:
            session.add(
                AdaptiveTopicPriority(
                    user_id=root.user_id,
                    topic_id=topic_id,
                    n=row.n,
                    errors=row.errors,
                    need=float(row.need),
                    priority=float(row.priority),
                    state=row.state,
                )
            )
            continue
        stored.n = row.n
        stored.errors = row.errors
        stored.need = float(row.need)
        stored.priority = float(row.priority)
        stored.state = row.state


async def state_payload(session: AsyncSession, user_id: uuid.UUID) -> dict[str, Any]:
    """Служебная сводка: сколько выдано и что открыто (для отладки и админки)."""
    root, state, pack = await _load(session, user_id)
    return {
        "release_key": pack.release_key,
        "seq": state.seq,
        "attempts": len(state.attempts),
        "observations": sum(1 for row in state.observations if not row.voided),
        "voided": sum(1 for row in state.observations if row.voided),
        "seen_families": len(state.seen_families),
        "open_attempt_id": state.open_attempt_id,
    }


async def reset(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Удаляет состояние пользователя (кнопка «начать заново» в настройках).

    Удаляются попытки, наблюдения и семьи; сама строка состояния остаётся,
    чтобы не потерять веса тем.
    """
    for model in (AdaptiveObservation, AdaptiveAttempt, AdaptiveSeenFamily, AdaptiveTopicPriority):
        await session.execute(delete(model).where(model.user_id == user_id))
    root = await session.scalar(
        select(AdaptiveState).where(AdaptiveState.user_id == user_id)
    )
    if root is not None:
        root.seq = 0
        root.open_attempt_id = None
    await session.commit()
