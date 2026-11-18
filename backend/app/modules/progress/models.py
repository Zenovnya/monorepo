"""ORM-модели модуля прогресса."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Progress(Base):
    """Прогресс пользователя по конкретному уроку.

    ``completed`` — пройден ли урок целиком.
    ``best_score`` — лучший процент правильных ответов (0..100).
    ``attempts`` — количество попыток завершения урока.
    ``crowns`` — число корон за прохождение (0..3).
    """

    __tablename__ = "progress"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_progress_user_lesson"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    best_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    crowns: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class LexBearProgress(Base):
    """Прогресс пользователя по урокам LexBear (int id уроков)."""

    __tablename__ = "lexbear_progress"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "lesson_id", name="uq_lexbear_progress_user_lesson"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lesson_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lexbear_lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    best_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    crowns: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ReviewLog(Base):
    """Запись о повторении карточки (SRS).

    Хранит результат каждого повторения для одного (user, case) и
    параметры интервального алгоритма SM-2 на момент повтора.
    """

    __tablename__ = "review_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quality: Mapped[int] = mapped_column(Integer, nullable=False)  # 0..5 (SM-2)
    repetitions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ease_factor: Mapped[float] = mapped_column(default=2.5, nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # relationship к case опционально — добавляется в content.models
    # (во избежание циклических импортов оставляем без relationship здесь)


# Модель состояния SRS пользователя для быстрого запроса повторений
class ReviewState(Base):
    """Текущее состояние SRS пользователя по конкретному кейсу."""

    __tablename__ = "review_states"
    __table_args__ = (
        UniqueConstraint("user_id", "case_id", name="uq_review_state_user_case"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    repetitions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ease_factor: Mapped[float] = mapped_column(default=2.5, nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    def __init__(self, **kwargs):
        # `default=` на колонке применяется только при INSERT, поэтому до
        # flush поля остаются None. SM-2 читает их сразу после создания
        # («первый ответ на кейс») и падал на `None + 1`. Дефолты дублируем
        # здесь, чтобы любая новая точка создания состояния была безопасной.
        kwargs.setdefault("repetitions", 0)
        kwargs.setdefault("interval_days", 0)
        kwargs.setdefault("ease_factor", 2.5)
        super().__init__(**kwargs)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

class DailyXp(Base):
    """Сколько XP пользователь заработал за конкретный день.

    Нужна для ежедневной цели: ``users.daily_goal`` задаётся в онбординге,
    но нигде не использовался — цели дня как механики не существовало.
    Считаем нарастающим итогом в пределах суток, чтобы не пересчитывать
    историю при каждом запросе.
    """

    __tablename__ = "daily_xp"
    __table_args__ = (
        UniqueConstraint("user_id", "day", name="uq_daily_xp_user_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Дата в UTC (см. gamification.service._today_utc).
    day: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
