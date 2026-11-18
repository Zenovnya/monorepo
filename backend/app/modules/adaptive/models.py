"""Хранение состояния адаптивного обучения.

Движок (``engine``) работает с состоянием в памяти: так он чистый и его
поведение можно воспроизвести. Здесь то же состояние лежит в БД — без него
ученик каждый раз начинал бы с нуля.

Две вещи, которые легко испортить и трудно заметить:

* **``seq`` монотонен на пользователя.** По нему упорядочены наблюдения и
  определяется, какая попытка была позже. ``created_at`` для этого не годится:
  два ответа в одну секунду сортируются произвольно, и окно «последних пяти»
  начинает зависеть от удачи.
* **Идентификаторы карточек — строки пака, а не внешние ключи.** Пак
  версионируется целиком (``pack_id@version``), поэтому ссылку на карточку
  нельзя выразить FK: после обновления пака карточки с тем же id может уже не
  быть. Вместе с id храним версию контента и ключ релиза — наблюдение остаётся
  осмысленным и после смены пака.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from fractions import Fraction

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.modules.adaptive import constants as c
from app.modules.adaptive import engine


class AdaptiveState(Base):
    """Корень состояния пользователя.

    ``seq`` — последний выданный номер события. ``open_attempt_id`` — открытая
    попытка (не больше одной), хранится строкой потому, что id попытки
    формируется движком как ``a{seq}``.
    """

    __tablename__ = "adaptive_states"
    __table_args__ = (UniqueConstraint("user_id", name="uq_adaptive_state_user"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    seq: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    open_attempt_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    release_key: Mapped[str] = mapped_column(String(128), nullable=False)
    weights: Mapped[dict] = mapped_column(
        # Веса тем: {"CIV": 100, ...}. JSON, потому что набор тем меняется
        # вместе с паком, а не с миграцией.
        nullable=False,
        type_=JSON,
        default=dict,
    )
    weights_version: Mapped[str] = mapped_column(
        String(32), default=c.INITIAL_CONFIG_VERSION, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AdaptiveAttempt(Base):
    """Выданная карточка и её исход."""

    __tablename__ = "adaptive_attempts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    lesson_id: Mapped[str] = mapped_column(String(32), nullable=False)
    topic_id: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    subtopic_id: Mapped[str] = mapped_column(String(64), nullable=False)
    evidence_family_id: Mapped[str] = mapped_column(String(96), nullable=False)
    content_version: Mapped[int] = mapped_column(Integer, nullable=False)
    mode: Mapped[str] = mapped_column(String(16), nullable=False)
    origin: Mapped[str] = mapped_column(String(16), nullable=False)
    issued_seq: Mapped[int] = mapped_column(Integer, nullable=False)
    terminal_seq: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preexposed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    assisted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="open", nullable=False)
    counted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    selected_option_id: Mapped[str | None] = mapped_column(String(8), nullable=True)
    correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AdaptiveObservation(Base):
    """Засчитанный ответ — единственное, что влияет на приоритет темы.

    ``voided`` вместо удаления: при споре о ключе или ошибке редакции нужно
    видеть, что запись была, но окно её не учитывает.
    """

    __tablename__ = "adaptive_observations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attempt_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    topic_id: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    subtopic_id: Mapped[str] = mapped_column(String(64), nullable=False)
    item_id: Mapped[str] = mapped_column(String(32), nullable=False)
    evidence_family_id: Mapped[str] = mapped_column(String(96), nullable=False)
    content_version: Mapped[int] = mapped_column(Integer, nullable=False)
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    voided: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AdaptiveSeenFamily(Base):
    """Семья заданий, уже показанная пользователю.

    Отдельная таблица, а не вывод из попыток: семья считается показанной в
    момент выдачи, даже если карточку закрыли пропуском. Иначе пропуск
    «возвращал» бы кейс в пул свежих.
    """

    __tablename__ = "adaptive_seen_families"
    __table_args__ = (
        UniqueConstraint("user_id", "family_id", name="uq_adaptive_seen_family"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    family_id: Mapped[str] = mapped_column(String(96), nullable=False)


class AdaptiveTopicPriority(Base):
    """Снимок приоритетов тем: нужен для экрана «прогресс по темам».

    Пересчитывается из наблюдений. Хранится, чтобы список тем не считался
    каждый раз заново и чтобы в интерфейсе были видны **те же** числа, по
    которым шёл выбор (иначе «рекомендуем CIV» и «CIV: 40%» расходятся).
    """

    __tablename__ = "adaptive_topic_priorities"
    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="uq_adaptive_topic_priority"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    topic_id: Mapped[str] = mapped_column(String(16), nullable=False)
    n: Mapped[int] = mapped_column(Integer, nullable=False)
    errors: Mapped[int] = mapped_column(Integer, nullable=False)
    need: Mapped[float] = mapped_column(Float, nullable=False)
    priority: Mapped[float] = mapped_column(Float, nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# --- Преобразование между БД и состоянием движка ---------------------------


def to_engine_state(
    root: AdaptiveState,
    attempts: list[AdaptiveAttempt],
    observations: list[AdaptiveObservation],
    seen: list[AdaptiveSeenFamily],
) -> engine.State:
    """Собирает состояние движка из строк БД.

    ``auto_shows`` восстанавливаются из попыток с ``origin='auto'``: отдельной
    таблицы нет, потому что выдача и попытка — одно событие.
    """
    state = engine.State(seq=root.seq, open_attempt_id=root.open_attempt_id)
    for row in sorted(attempts, key=lambda a: a.issued_seq):
        attempt = engine.Attempt(
            id=row.id,
            item_id=row.item_id,
            topic_id=row.topic_id,
            subtopic_id=row.subtopic_id,
            mode=row.mode,
            origin=row.origin,
            issued_seq=row.issued_seq,
            content_version=row.content_version,
            evidence_family_id=row.evidence_family_id,
            preexposed=row.preexposed,
            assisted=row.assisted,
            status=row.status,
            terminal_seq=row.terminal_seq,
            counted=row.counted,
            reason=row.reason,
            selected_option_id=row.selected_option_id,
            correct=row.correct,
        )
        state.attempts[attempt.id] = attempt
        if row.origin == c.ORIGIN_AUTO:
            state.auto_shows.append(
                engine.AutoShow(
                    topic_id=row.topic_id, seq=row.issued_seq, attempt_id=row.id
                )
            )
    state.seen_families = [row.family_id for row in seen]
    for row in sorted(observations, key=lambda o: o.seq):
        state.observations.append(
            engine.Observation(
                seq=row.seq,
                topic_id=row.topic_id,
                subtopic_id=row.subtopic_id,
                item_id=row.item_id,
                evidence_family_id=row.evidence_family_id,
                correct=row.correct,
                attempt_id=row.attempt_id,
                voided=row.voided,
                content_version=row.content_version,
            )
        )
    return state


def sync_weights(root: AdaptiveState, topics: dict[str, dict]) -> dict[str, int]:
    """Возвращает веса пользователя, добавляя новые темы с базовым весом.

    Пак может получить новую тему между релизами. Без этого ученик со старыми
    весами не увидел бы её вовсе: ``validate_weights`` требует полного набора.
    """
    base = {topic_id: row["weight_pct"] for topic_id, row in topics.items()}
    stored = dict(root.weights or {})
    merged = {topic_id: stored.get(topic_id, weight) for topic_id, weight in base.items()}
    if merged != stored:
        root.weights = merged
    return merged


def need_as_percent(value: Fraction) -> float:
    """Дробь → число для экрана. Ранжирование уже произошло, округление безопасно."""
    return round(float(value) * 100, 1)
