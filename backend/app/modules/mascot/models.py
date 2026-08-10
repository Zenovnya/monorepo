"""ORM-модели модуля маскота."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MascotPhrase(Base):
    """Фраза маскота, привязанная к триггеру и эмоции.

    ``show_once`` — фраза показывается пользователю только один раз
    (история показов ведётся в ``UserShownPhrase``).
    ``weight`` — вес для случайного выбора между фразами одного триггера.
    """

    __tablename__ = "mascot_phrases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    trigger: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    phrase: Mapped[str] = mapped_column(Text, nullable=False)
    emotion: Mapped[str] = mapped_column(String(64), nullable=False)
    weight: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    show_once: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    shown_records: Mapped[list["UserShownPhrase"]] = relationship(
        back_populates="phrase",
        cascade="all, delete-orphan",
    )


class UserMascotState(Base):
    """Состояние маскота для конкретного пользователя.

    ``last_phrase_id`` — денормализованное поле для быстрого доступа к
    последней показанной фразе. Реальная история показов (для логики
    ``show_once``) хранится в ``UserShownPhrase``.
    """

    __tablename__ = "user_mascot_state"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    pet_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_phrase_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mascot_phrases.id", ondelete="SET NULL"),
        nullable=True,
    )
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

    last_phrase: Mapped["MascotPhrase | None"] = relationship(
        foreign_keys=[last_phrase_id],
    )


class UserShownPhrase(Base):
    """История показанных пользователю фраз.

    Одна запись на пару (user_id, phrase_id) — используется для реализации
    логики ``show_once``.
    """

    __tablename__ = "user_shown_phrases"
    __table_args__ = (
        UniqueConstraint("user_id", "phrase_id", name="uq_user_shown_phrases"),
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
    phrase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mascot_phrases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shown_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    phrase: Mapped["MascotPhrase"] = relationship(back_populates="shown_records")