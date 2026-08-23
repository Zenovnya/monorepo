"""add lexbear_progress table

Revision ID: 0011
Revises: 0010
Create Date: 2026-01-01 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lexbear_progress",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("best_score", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("crowns", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lesson_id"], ["lexbear_lessons.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_lexbear_progress_user_lesson"),
    )
    op.create_index("ix_lexbear_progress_user_id", "lexbear_progress", ["user_id"])
    op.create_index("ix_lexbear_progress_lesson_id", "lexbear_progress", ["lesson_id"])


def downgrade() -> None:
    op.drop_index("ix_lexbear_progress_lesson_id", table_name="lexbear_progress")
    op.drop_index("ix_lexbear_progress_user_id", table_name="lexbear_progress")
    op.drop_table("lexbear_progress")