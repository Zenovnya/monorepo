"""daily xp counter for the daily goal

``users.daily_goal`` задаётся в онбординге (минуты в день × 2), но нигде не
использовался: цели дня как механики не было, а значит и понять «выполнил ли
я норму сегодня» было нельзя. Добавляем счётчик XP по дням.

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-17 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_xp",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("day", sa.DateTime(timezone=True), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "day", name="uq_daily_xp_user_day"),
    )
    op.create_index(
        "ix_daily_xp_user_id", "daily_xp", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_daily_xp_user_id", table_name="daily_xp")
    op.drop_table("daily_xp")
