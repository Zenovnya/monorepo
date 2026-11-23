"""ORM-модели прогресса: дневной счётчик XP.

Прогресс по урокам и SRS-состояния относились к старому контенту
(``branches/lessons/cases``) и удалены вместе с ним. Новый прогресс —
попытки и наблюдения — живёт в ``app/modules/adaptive/models.py``.

``daily_xp`` остаётся здесь, потому что им пользуется ежедневная цель
(``gamification.add_xp`` / ``/gamification/daily-goal``), а она не зависит от
того, из какого пака взят контент.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


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
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )
