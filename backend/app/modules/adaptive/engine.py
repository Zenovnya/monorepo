"""Детерминированный отбор кейсов: порт эталона ``theme-mvp-1``.

Правила перенесены из спецификации (``docs/adaptive-engine.md``) дословно,
включая порядок разрешения равенств: любое «улучшение» здесь меняет то, какой
кейс увидит ученик, а значит и то, на чём он будет учиться.

Что делает сервер, а что нет:

- **Сервер** выбирает кейс, сверяет ``option_id`` с ключом, ведёт окно
  наблюдений и считает приоритет тем. Одинаковое состояние даёт одинаковый
  ответ — это проверяется тестами.
- **ИИ** (если появится) ведёт диалог и объясняет **уже возвращённый**
  результат. Он не назначает правильный ответ и не выставляет баллы, иначе
  оценка перестаёт быть проверяемой.

Модуль чистый: ни БД, ни сети, ни времени. Состояние передаётся снаружи
(``State``), поэтому одни и те же функции работают и в тестах, и в проде.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Any

from app.modules.adaptive import constants as c
from app.modules.adaptive.errors import EngineError, require
from app.modules.adaptive.pack import (
    Pack,
    available,
    validate_weights,
)

__all__ = [
    "Attempt",
    "AutoShow",
    "Choice",
    "EngineError",
    "Observation",
    "Pack",
    "State",
    "TopicMetrics",
    "act",
    "available",
    "cancel_obsolete",
    "choose",
    "issue",
    "lesson_payload",
    "metrics",
    "new_attempt_id",
    "public_item",
    "validate_weights",
    "void_observation",
]


# --- Состояние -------------------------------------------------------------


@dataclass
class Observation:
    """Один засчитанный ответ. Только они влияют на приоритет темы."""

    seq: int
    topic_id: str
    subtopic_id: str
    item_id: str
    evidence_family_id: str
    correct: bool
    attempt_id: str
    voided: bool = False
    content_version: int = 1


@dataclass
class Attempt:
    """Попытка ответить. Открыта максимум одна на пользователя."""

    id: str
    item_id: str
    topic_id: str
    subtopic_id: str
    mode: str
    origin: str
    issued_seq: int
    content_version: int
    evidence_family_id: str
    preexposed: bool = False
    assisted: bool = False
    status: str = "open"
    terminal_seq: int | None = None
    counted: bool = False
    reason: str | None = None
    selected_option_id: str | None = None
    correct: bool | None = None


@dataclass
class AutoShow:
    """Фактическая автоматическая выдача темы (для ротации)."""

    topic_id: str
    seq: int
    attempt_id: str


@dataclass
class State:
    """Изменяемое состояние пользователя.

    Порядок событий задаёт ``seq`` — монотонный серверный счётчик. Часы нужны
    только для аудита: два ответа в одну секунду не должны менять приоритет.
    """

    seq: int = 0
    open_attempt_id: str | None = None
    # Чей это id. Нужен, чтобы id попытки был уникален глобально, а не только
    # внутри пользователя (см. `_attempt_public_id`).
    user_key: str = ""
    attempts: dict[str, Attempt] = field(default_factory=dict)
    seen_families: list[str] = field(default_factory=list)
    observations: list[Observation] = field(default_factory=list)
    auto_shows: list[AutoShow] = field(default_factory=list)

    def next_seq(self) -> int:
        self.seq += 1
        return self.seq

    def next_attempt_id(self, seq: int) -> str:
        """Идентификатор попытки, уникальный глобально.

        Реальный дефект: id был просто ``a{seq}``, где seq считается внутри
        пользователя. ``adaptive_attempts.id`` — первичный ключ таблицы, значит
        первый же пользователь занимал ``a1``, и у всех остальных выдача падала:

            UNIQUE constraint failed: adaptive_attempts.id ('a1', ...)

        Клиент получал 500 на /adaptive/next. Выглядело это как «часть уроков
        не открывает кейсы»: кому достался свободный номер — работал, кому нет —
        нет.

        Префикс — короткая часть id пользователя. Длина: 2 + 8 + 1 + до 6 цифр
        ≈ 17 символов, колонка ``String(32)`` вмещает.
        """
        prefix = self.user_key[:8] or "anon"
        return f"a{prefix}-{seq}"


# --- Метрики темы ----------------------------------------------------------


@dataclass
class TopicMetrics:
    """Состояние темы: окно наблюдений и приоритет практики."""

    topic_id: str
    n: int
    errors: int
    need: Fraction
    priority: Fraction
    state: str
    rows: list[Observation]
    weight_pct: int

    @property
    def correct_count(self) -> int:
        return self.n - self.errors

    def as_dict(self) -> dict[str, Any]:
        return {
            "topic_id": self.topic_id,
            "n": self.n,
            "errors": self.errors,
            "correct_count": self.correct_count,
            # float только для показа. Ранжирование идёт по точной дроби,
            # поэтому округление здесь ничего не решает.
            "need": float(self.need),
            "priority": float(self.priority),
            "weight_pct": self.weight_pct,
            "state": self.state,
        }


def metrics(
    pack: Pack, state: State, weights: dict[str, int] | None = None
) -> dict[str, TopicMetrics]:
    """Считает ``need`` и ``priority`` по последним пяти засчитанным ответам.

    ``need = (2 + e) / (4 + n)``: две условные ошибки на четыре условных ответа
    сглаживают холодный старт. Это **приоритет полезной практики**, не
    вероятность знания и не процент правильных ответов — в интерфейсе так и
    подписано.
    """
    resolved = validate_weights(pack, weights)
    by_topic: dict[str, list[Observation]] = {topic_id: [] for topic_id in pack.topics}
    for observation in sorted(state.observations, key=lambda row: row.seq):
        # Отозванные наблюдения исключаются до взятия последних пяти: иначе
        # карантин одной ошибки сдвинул бы окно и «простил» её.
        if not observation.voided and observation.topic_id in by_topic:
            by_topic[observation.topic_id].append(observation)

    result: dict[str, TopicMetrics] = {}
    for topic_id, rows in by_topic.items():
        window = rows[-c.WINDOW_SIZE:]
        n = len(window)
        errors = sum(1 for row in window if not row.correct)
        need = Fraction(c.PRIOR_ERRORS + errors, c.PRIOR_ANSWERS + n)
        state_label = (
            c.STATE_NOT_ASSESSED
            if n == 0
            else c.STATE_LIMITED
            if n <= 2
            else c.STATE_RECENT_RESULTS
        )
        result[topic_id] = TopicMetrics(
            topic_id=topic_id,
            n=n,
            errors=errors,
            need=need,
            priority=need * Fraction(resolved[topic_id], 100),
            state=state_label,
            rows=window,
            weight_pct=resolved[topic_id],
        )
    return result


def _live(pack: Pack, attempt: Attempt, sandbox: bool) -> bool:
    """Жива ли открытая попытка: та же версия карточки и она допущена."""
    item = pack.items.get(attempt.item_id)
    return (
        item is not None
        and item["content_version"] == attempt.content_version
        and available(pack, item, sandbox)
    )


def cancel_obsolete(pack: Pack, state: State, sandbox: bool = False) -> None:
    """Закрывает открытую попытку, если карточку отозвали или сменили версию.

    Отзыв контента не должен оставлять ученика с вопросом, который больше
    нельзя показывать: попытка закрывается без зачёта с причиной
    ``CONTENT_UNAVAILABLE``, ключ не раскрывается.
    """
    attempt_id = state.open_attempt_id
    if attempt_id is None:
        return
    attempt = state.attempts[attempt_id]
    if not _live(pack, attempt, sandbox):
        attempt.status = "cancelled"
        attempt.terminal_seq = state.next_seq()
        attempt.counted = False
        attempt.reason = c.REASON_CONTENT_UNAVAILABLE
        state.open_attempt_id = None


# --- Выбор кейса -----------------------------------------------------------


@dataclass
class Choice:
    """Решение сервера: что показать следующим."""

    kind: str
    reason: str
    topic_id: str | None = None
    item_id: str | None = None
    lesson_id: str | None = None
    attempt_id: str | None = None
    origin: str | None = None
    matched_error_tag: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            key: value
            for key, value in {
                "kind": self.kind,
                "reason": self.reason,
                "topic_id": self.topic_id,
                "item_id": self.item_id,
                "lesson_id": self.lesson_id,
                "attempt_id": self.attempt_id,
                "origin": self.origin,
                "matched_error_tag": self.matched_error_tag,
            }.items()
            if value is not None
        }


def choose(
    pack: Pack,
    state: State,
    *,
    topic_id: str | None = None,
    lesson_id: str | None = None,
    weights: dict[str, int] | None = None,
    sandbox: bool = False,
) -> Choice:
    """Выбирает следующий кейс.

    Порядок из спецификации: возобновить открытую попытку → явный урок →
    явная тема → автоматический выбор по приоритету с ротацией.
    """
    require(topic_id is None or topic_id in pack.topics, "UNKNOWN_TOPIC")
    require(lesson_id is None or lesson_id in pack.lessons, "UNKNOWN_LESSON")
    require(topic_id is None or lesson_id is None, "AMBIGUOUS_CHOICE")

    cancel_obsolete(pack, state, sandbox)
    if state.open_attempt_id is not None:
        return Choice(
            kind=c.CHOICE_RESUME, reason=c.REASON_OPEN_ATTEMPT, attempt_id=state.open_attempt_id
        )

    if lesson_id is not None:
        lesson = pack.lessons[lesson_id]
        selected = available(pack, pack.items[lesson["guide_id"]], sandbox)
        return Choice(
            kind=c.CHOICE_LESSON if selected else c.CHOICE_NONE,
            reason=c.REASON_USER_LESSON if selected else c.REASON_NO_PUBLISHED_CONTENT,
            lesson_id=lesson_id,
        )

    live_items = [
        item
        for item in pack.items.values()
        if (topic_id is None or item["primary_topic_id"] == topic_id)
        and available(pack, item, sandbox)
    ]
    seen = set(state.seen_families)
    fresh_pool: dict[str, list[dict]] = {}
    for item in live_items:
        if item["kind"] == c.KIND_RECOMMEND_CASE and item["evidence_family_id"] not in seen:
            fresh_pool.setdefault(item["primary_topic_id"], []).append(item)

    if fresh_pool:
        topic_metrics = metrics(pack, state, weights)
        reason = c.REASON_USER_TOPIC if topic_id is not None else c.REASON_THEME_PRIORITY
        candidates = list(fresh_pool)
        last_auto = {show.topic_id: show.seq for show in state.auto_shows}

        # Ротация: две автоматические выдачи подряд по одной теме → третью не
        # даём, если у другой темы есть свежий кейс. Считаются именно выдачи,
        # включая затем пропущенные: пропуск серию не сбрасывает.
        if topic_id is None and len(state.auto_shows) >= c.MAX_AUTO_TOPIC_STREAK:
            tail = state.auto_shows[-c.MAX_AUTO_TOPIC_STREAK :]
            if len({show.topic_id for show in tail}) == 1:
                others = [key for key in candidates if key != tail[-1].topic_id]
                if others:
                    # Среди альтернатив сначала непроверенные темы (n=0).
                    candidates = [key for key in others if topic_metrics[key].n == 0] or others
                    reason = c.REASON_ROTATE_TOPIC

        # Порядок разрешения равенств: приоритет ↓, непроверенная тема, самая
        # старая автоматическая выдача, порядок темы, id. Поэтому пустой
        # профиль воспроизводим: начнётся с CIV01_R1.
        topic = min(
            candidates,
            key=lambda key: (
                -topic_metrics[key].priority,
                topic_metrics[key].n != 0,
                last_auto.get(key, 0),
                pack.topics[key]["order"],
                key,
            ),
        )

        # Внутри темы: тег, по которому последний ответ в окне был ошибкой.
        tags = {item["subtopic_id"] for item in fresh_pool[topic]}
        latest_by_tag: dict[str, Observation] = {}
        for observation in topic_metrics[topic].rows:
            latest_by_tag[observation.subtopic_id] = observation
        misses = [
            observation
            for tag, observation in latest_by_tag.items()
            if tag in tags and not observation.correct
        ]
        preferred = max(misses, key=lambda row: row.seq).subtopic_id if misses else None

        item = min(
            fresh_pool[topic],
            key=lambda row: (
                row["subtopic_id"] != preferred,
                pack.lessons[row["lesson_id"]]["order"],
                row["id"],
            ),
        )
        return Choice(
            kind=c.CHOICE_NEW_CASE,
            reason=reason,
            topic_id=topic,
            item_id=item["id"],
            origin=c.ORIGIN_AUTO if topic_id is None else c.ORIGIN_MANUAL,
            matched_error_tag=preferred,
        )

    # Свежих кейсов нет. Повтор предлагаем, но не открываем за пользователя.
    known = [
        item
        for item in live_items
        if item["kind"] in c.SCORE_KINDS and item["evidence_family_id"] in seen
    ]
    if known:
        misses_by_family = {
            observation.evidence_family_id: observation.seq
            for observation in sorted(state.observations, key=lambda row: row.seq)
            if not observation.voided and not observation.correct
        }
        last_seen = {
            attempt.evidence_family_id: attempt.issued_seq
            for attempt in sorted(state.attempts.values(), key=lambda row: row.issued_seq)
        }
        item = min(
            known,
            key=lambda row: (
                -misses_by_family.get(row["evidence_family_id"], 0),
                -last_seen.get(row["evidence_family_id"], 0),
                pack.topics[row["primary_topic_id"]]["order"],
                pack.lessons[row["lesson_id"]]["order"],
                row["id"],
            ),
        )
        return Choice(
            kind=c.CHOICE_REVIEW,
            reason=c.REASON_FRESH_EXHAUSTED,
            item_id=item["id"],
            topic_id=item["primary_topic_id"],
        )

    return Choice(
        kind=c.CHOICE_CATALOG if live_items else c.CHOICE_NONE,
        reason=c.REASON_FRESH_EXHAUSTED if live_items else c.REASON_NO_PUBLISHED_CONTENT,
        topic_id=topic_id,
    )


# --- Попытки ---------------------------------------------------------------

_ALLOWED_MODES = {
    c.KIND_GUIDE: {c.MODE_GUIDE, c.MODE_PRACTICE},
    c.KIND_LESSON_CHECK: {c.MODE_CHECK, c.MODE_PRACTICE},
    c.KIND_RECOMMEND_CASE: {c.MODE_FRESH_CASE, c.MODE_PRACTICE},
}


def issue(
    pack: Pack,
    state: State,
    item_id: str,
    *,
    mode: str,
    origin: str,
    sandbox: bool = False,
    config_version: str = c.INITIAL_CONFIG_VERSION,
) -> Attempt:
    """Открывает попытку **только по решению сервера**, под блокировкой юзера.

    Клиент не выбирает ``mode``/``origin``: ручка ``/next`` сама передаёт сюда
    то, что решил ``choose``. Иначе клиент выдал бы себе ``fresh_case`` и
    получил засчитанное наблюдение за уже показанный кейс.
    """
    cancel_obsolete(pack, state, sandbox)
    require(state.open_attempt_id is None, "OPEN_ATTEMPT")
    item = pack.items.get(item_id)
    require(item is not None, "UNKNOWN_ITEM")
    require(available(pack, item, sandbox), c.REASON_CONTENT_UNAVAILABLE)
    require(mode in _ALLOWED_MODES[item["kind"]], "WRONG_MODE")
    require(
        origin in {c.ORIGIN_AUTO, c.ORIGIN_MANUAL, c.ORIGIN_LESSON}
        and (origin != c.ORIGIN_AUTO or mode == c.MODE_FRESH_CASE),
        "BAD_ORIGIN",
    )

    family = item["evidence_family_id"]
    preexposed = family in state.seen_families
    # Новый кейс не может быть уже предъявленной семьёй: иначе «свежая»
    # карточка окажется той же задачей в другой обёртке.
    require(not (mode == c.MODE_FRESH_CASE and preexposed), c.REASON_FAMILY_SEEN)
    if not preexposed:
        state.seen_families.append(family)
    if preexposed and mode == c.MODE_CHECK:
        mode = c.MODE_PRACTICE

    seq = state.next_seq()
    attempt = Attempt(
        id=state.next_attempt_id(seq),
        item_id=item["id"],
        content_version=item["content_version"],
        evidence_family_id=family,
        topic_id=item["primary_topic_id"],
        subtopic_id=item["subtopic_id"],
        mode=mode,
        origin=origin,
        issued_seq=seq,
        preexposed=preexposed,
        status="open",
    )
    state.attempts[attempt.id] = attempt
    state.open_attempt_id = attempt.id
    if origin == c.ORIGIN_AUTO:
        state.auto_shows.append(
            AutoShow(topic_id=attempt.topic_id, seq=seq, attempt_id=attempt.id)
        )
    return attempt


def act(
    pack: Pack,
    state: State,
    attempt_id: str,
    action: str,
    option_id: str | None = None,
    *,
    sandbox: bool = False,
) -> dict[str, Any]:
    """Действие над попыткой: ``answer``, ``help``, ``skip`` или ``reveal``.

    Засчитывается (``counted``) только первый самостоятельный ответ на новую
    семью. Подсказка, пропуск, показ разбора и повтор семьи сохраняют причину
    незачёта — иначе «потренировался» выглядело бы как «знает».
    """
    require(action in {"answer", "help", "skip", "reveal"}, "BAD_ACTION")
    cancel_obsolete(pack, state, sandbox)
    attempt = state.attempts.get(attempt_id)
    require(attempt is not None, "UNKNOWN_ATTEMPT")

    if attempt.status != "open":
        # Повторный запрос не меняет исход: возвращается уже принятое решение.
        # Две вкладки с разными ответами — выигрывает первый.
        return {
            "status": attempt.status,
            "reason": attempt.reason,
            "counted": attempt.counted,
            "already_closed": True,
        }
    require(state.open_attempt_id == attempt_id, "NOT_OPEN")

    item = pack.items[attempt.item_id]
    if action == "help":
        # Помощь не закрывает попытку, но навсегда снимает зачёт: иначе
        # подсказка была бы бесплатной подсказкой к оцениваемому ответу.
        attempt.assisted = True
        return {
            "status": "open",
            "assistance": item.get("hint") or pack.lessons[item["lesson_id"]]["theory"],
        }

    if action == "answer":
        require(option_id in {option["id"] for option in item["options"]}, "BAD_OPTION")
        attempt.selected_option_id = option_id
        attempt.correct = option_id == item["correct_option_id"]

    family_already_counted = any(
        observation.evidence_family_id == attempt.evidence_family_id
        for observation in state.observations
    )
    if action == "skip":
        reason = c.REASON_SKIP
    elif action == "reveal":
        reason = c.REASON_REVEAL
    elif attempt.mode == c.MODE_GUIDE:
        reason = c.REASON_NOT_ASSESSMENT
    elif attempt.preexposed or family_already_counted:
        reason = c.REASON_FAMILY_SEEN
    elif attempt.mode == c.MODE_PRACTICE:
        reason = c.REASON_PRACTICE
    elif attempt.assisted:
        reason = c.REASON_ASSISTED
    else:
        reason = c.REASON_COUNTED

    attempt.status = {"answer": "answered", "skip": "skipped", "reveal": "revealed"}[action]
    attempt.terminal_seq = state.next_seq()
    attempt.counted = reason == c.REASON_COUNTED
    attempt.reason = reason
    state.open_attempt_id = None

    if attempt.counted:
        state.observations.append(
            Observation(
                seq=attempt.terminal_seq,
                topic_id=attempt.topic_id,
                subtopic_id=attempt.subtopic_id,
                item_id=attempt.item_id,
                evidence_family_id=attempt.evidence_family_id,
                correct=bool(attempt.correct),
                attempt_id=attempt.id,
                content_version=attempt.content_version,
            )
        )

    # ``already_closed`` появляется только при повторном действии: клиенту
    # важно отличить «ответ принят» от «попытка уже была закрыта».
    result: dict[str, Any] = {
        "status": attempt.status,
        "reason": reason,
        "counted": attempt.counted,
    }
    if action in {"answer", "reveal"}:
        result["correct_option_id"] = item["correct_option_id"]
        result["options"] = item["options"]
        result["legal_basis_ids"] = item["legal_basis_ids"]
    if action == "answer":
        result["correct"] = attempt.correct
    return result


def void_observation(state: State, attempt_id: str) -> bool:
    """Карантин наблюдения: спорный ключ или ошибка редакции.

    История не переписывается — запись остаётся с ``voided=True``, но окно
    пересчитывается без неё.
    """
    for observation in state.observations:
        if observation.attempt_id == attempt_id and not observation.voided:
            observation.voided = True
            return True
    return False


def public_item(pack: Pack, item_id: str) -> dict[str, Any]:
    """Карточка для пользователя **до ответа**.

    Изоляция формы: только условие, вопрос и ``{id, text}``. Ни ключа, ни
    объяснений, ни ссылок на нормы — иначе ответ читается прямо из ответа API.
    """
    item = pack.items[item_id]
    lesson = pack.lessons[item["lesson_id"]]
    topic = pack.topics[item["primary_topic_id"]]
    return {
        "item_id": item["id"],
        "kind": item["kind"],
        "topic_id": item["primary_topic_id"],
        "topic_title": topic["title"],
        "lesson_id": item["lesson_id"],
        "lesson_title": lesson["title"],
        "subtopic_id": item["subtopic_id"],
        "situation": item["situation"],
        "question": item["question"],
        "options": [{"id": option["id"], "text": option["text"]} for option in item["options"]],
    }


def lesson_payload(pack: Pack, lesson_id: str) -> dict[str, Any]:
    """Учебный экран урока: теория, шаги и разбор.

    Теория и действия выдаются только здесь, на учебном экране, и никогда — в
    проверку: иначе проверка перестаёт проверять.
    """
    lesson = pack.lessons[lesson_id]
    topic = pack.topics[lesson["primary_topic_id"]]
    return {
        "lesson_id": lesson["id"],
        "title": lesson["title"],
        "short_title": lesson.get("short_title") or lesson["title"],
        "order": lesson["order"],
        "goal": lesson["goal"],
        "theory": lesson["theory"],
        "actions": lesson["actions"],
        "topic_id": lesson["primary_topic_id"],
        "topic_title": topic["title"],
        "subtopic_id": lesson["subtopic_id"],
        "legal_basis_ids": lesson["legal_basis_ids"],
        "sources": lesson.get("sources", []),
        "guide_item_id": lesson["guide_id"],
        "control_item_id": lesson["control_id"],
        "content_version": lesson.get("content_version", 1),
        "legal_review_status": lesson["legal_review_status"],
    }


def new_attempt_id() -> str:
    """Внешний идентификатор попытки для API (внутри движка — ``a{seq}``)."""
    return str(uuid.uuid4())
