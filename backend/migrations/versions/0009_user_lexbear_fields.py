"""add lexbear profile fields to users

Revision ID: 0009
Revises: 0008
Create Date: 2026-01-01 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("name", sa.String(length=255), nullable=False, server_default="Юрист"),
    )
    op.add_column(
        "users",
        sa.Column("lives", sa.Integer(), nullable=False, server_default=sa.text("5")),
    )
    op.add_column(
        "users",
        sa.Column(
            "league",
            sa.String(length=32),
            nullable=False,
            server_default="Бронза",
        ),
    )
    op.add_column(
        "users",
        sa.Column("daily_goal", sa.Integer(), nullable=False, server_default=sa.text("10")),
    )
    op.add_column(
        "users",
        sa.Column("onboarded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "users",
        sa.Column("bear_mood", sa.Integer(), nullable=False, server_default=sa.text("80")),
    )
    op.add_column(
        "users",
        sa.Column("bear_hunger", sa.Integer(), nullable=False, server_default=sa.text("70")),
    )
    op.add_column(
        "users",
        sa.Column("bear_level", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "users",
        sa.Column(
            "bear_outfit",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "bear_outfit")
    op.drop_column("users", "bear_level")
    op.drop_column("users", "bear_hunger")
    op.drop_column("users", "bear_mood")
    op.drop_column("users", "onboarded")
    op.drop_column("users", "daily_goal")
    op.drop_column("users", "league")
    op.drop_column("users", "lives")
    op.drop_column("users", "name")