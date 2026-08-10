"""ORM-модели модуля контента."""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Branch(Base):
    """Ветка обучения (раздел контента)."""

    __tablename__ = "branches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_premium: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="branch",
        cascade="all, delete-orphan",
    )


class Lesson(Base):
    """Урок в составе ветки (теория)."""

    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    branch: Mapped["Branch"] = relationship(back_populates="lessons")
    cases: Mapped[list["Case"]] = relationship(
        back_populates="lesson",
        cascade="all, delete-orphan",
    )


class Case(Base):
    """Кейс (практическое задание) внутри урока.

    Поддерживает несколько типов кейсов через ``case_type``:
    - ``simple`` — обычный кейс с вариантами ответа;
    - ``lex_entrance`` — кейс с появлением персонажа Lex;
    - ``scene`` — зарезервировано под будущие полные сцены.
    """

    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    situation: Mapped[str] = mapped_column(Text, nullable=False)
    case_type: Mapped[str] = mapped_column(
        String(32),
        default="simple",
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Поля Lex (для кейсов типа lex_entrance)
    lex_entrance_type: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
    )
    lex_hint_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    lex_hint_option_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # Поля для будущих полных сцен (case_type = 'scene')
    scene_background: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    scene_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    lesson: Mapped["Lesson"] = relationship(back_populates="cases")
    options: Mapped[list["CaseOption"]] = relationship(
        back_populates="case",
        cascade="all, delete-orphan",
    )


class CaseOption(Base):
    """Вариант ответа для кейса."""

    __tablename__ = "case_options"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    case: Mapped["Case"] = relationship(back_populates="options")