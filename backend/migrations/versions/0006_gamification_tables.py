"""add gamification fields and achievements

Revision ID: 0006
Revises: 0005
Create Date: 2026-01-01 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем геймификационные поля в users.
    op.add_column(
        "users",
        sa.Column("xp", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "users",
        sa.Column("level", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "users",
        sa.Column("streak", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "users",
        sa.Column("last_active_day", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("gems", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    # Таблица достижений пользователя.
    op.create_table(
        "user_achievements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=512), nullable=False),
        sa.Column(
            "awarded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_achievements_user_id", table_name="user_achievements")
    op.drop_table("user_achievements")
    op.drop_column("users", "gems")
    op.drop_column("users", "last_active_day")
    op.drop_column("users", "streak")
    op.drop_column("users", "level")
    op.drop_column("users", "xp")