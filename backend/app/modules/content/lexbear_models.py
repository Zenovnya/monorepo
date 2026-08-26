"""ORM-модели контента LexBear (юниты, уроки, теория, вопросы, статьи)."""

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
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Unit(Base):
    """Остров/юнит обучения LexBear."""

    __tablename__ = "units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
    )
    codex: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(255), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    color: Mapped[str] = mapped_column(
        String(16),
        default="#C9A227",
        nullable=False,
    )
    locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    why_practical: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )


class LexBearLesson(Base):
    """Урок в составе юнита LexBear."""

    __tablename__ = "lexbear_lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("units.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, default=10, nullable=False)


class TheoryCard(Base):
    """Карточка теории в рамках урока LexBear."""

    __tablename__ = "theory_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lexbear_lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    definition: Mapped[str] = mapped_column(Text, nullable=False)
    practical: Mapped[str] = mapped_column(Text, nullable=False)
    chips: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    bear_line: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )


class Question(Base):
    """Вопрос/задание урока LexBear.

    Поле ``correct`` хранит ответ(ы) в виде JSON:
    - для одиночного выбора — целое число (индекс правильного варианта);
    - для множественного выбора — список индексов;
    - для true/false — булево значение.
    """

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lexbear_lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    case_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    options: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    correct: Mapped[object] = mapped_column(JSON, nullable=False)
    explanation: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )


class Article(Base):
    """Справочная статья (кодекс) LexBear."""

    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
    )
    codex: Mapped[str] = mapped_column(String(32), nullable=False)
    number: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    plain: Mapped[str] = mapped_column(Text, nullable=False)
    full: Mapped[str] = mapped_column(Text, nullable=False)


class LearnedArticle(Base):
    """Связь «пользователь выучил статью»."""

    __tablename__ = "learned_articles"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "article_id",
            name="learned_user_article_uq",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    article_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
    )
    learned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )