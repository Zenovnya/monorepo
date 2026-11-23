"""ORM-модели модуля аутентификации."""

import uuid
from datetime import datetime

from app.utils import is_expired

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    """Пользователь системы."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # --- Геймификация ---
    xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_active_day: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    gems: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # --- Профиль LexBear ---
    name: Mapped[str] = mapped_column(
        String(255),
        default="Юрист",
        nullable=False,
    )
    lives: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    # Момент последней траты жизни. От него считается восстановление:
    # одна жизнь за LIFE_REGEN_MINUTES. Раньше жизни только уменьшались —
    # обнулившийся счётчик не восстанавливался никогда, и единственным
    # способом продолжить было купить «Пополнение жизней» за гемы.
    lives_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    league: Mapped[str] = mapped_column(
        String(32),
        default="Бронза",
        nullable=False,
    )
    daily_goal: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    onboarded: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    # Настроение и сытость мишки (0..100)
    bear_mood: Mapped[int] = mapped_column(Integer, default=80, nullable=False)
    bear_hunger: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    bear_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    bear_outfit: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserAchievement(Base):
    """Достижение пользователя."""

    __tablename__ = "user_achievements"

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
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )


class RefreshToken(Base):
    """Refresh-токен пользователя, хранящийся в БД."""

    __tablename__ = "refresh_tokens"

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
    token: Mapped[str] = mapped_column(
        String(512),
        unique=True,
        index=True,
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")

    @property
    def is_expired(self) -> bool:
        """Проверяет, истёк ли срок действия токена.

        SQLite не хранит информацию о таймзоне в DateTime, поэтому
        ``expires_at`` может приходить offset-naive. Сравнение aware и
        naive datetime бросает TypeError, поэтому сравнение делается
        через ``is_expired`` с приведением обеих сторон к UTC.
        """
        return is_expired(self.expires_at)


class PasswordResetToken(Base):
    """Одноразовый токен сброса пароля.

    Хранится только sha256-хеш значения — как и refresh-токены: утечка дампа
    БД не должна давать возможность сбросить чужой пароль. ``used_at``
    фиксирует момент использования, чтобы токен нельзя было применить дважды.
    """

    __tablename__ = "password_reset_tokens"

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
    token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )
