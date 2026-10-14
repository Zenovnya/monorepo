"""add progress, review_logs, review_states

Revision ID: 0005
Revises: 0004_mascot_tables
Create Date: 2026-01-01 00:00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("best_score", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("crowns", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_progress_user_id", "progress", ["user_id"])
    op.create_index("ix_progress_lesson_id", "progress", ["lesson_id"])
    op.create_unique_constraint("uq_progress_user_lesson", "progress", ["user_id", "lesson_id"])

    op.create_table(
        "review_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("ease_factor", sa.Float(), nullable=False, server_default=sa.text("2.5")),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_review_states_user_id", "review_states", ["user_id"])
    op.create_index("ix_review_states_case_id", "review_states", ["case_id"])
    op.create_unique_constraint("uq_review_state_user_case", "review_states", ["user_id", "case_id"])

    op.create_table(
        "review_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quality", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("ease_factor", sa.Float(), nullable=False, server_default=sa.text("2.5")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_review_logs_user_id", "review_logs", ["user_id"])
    op.create_index("ix_review_logs_case_id", "review_logs", ["case_id"])


def downgrade() -> None:
    op.drop_table("review_logs")
    op.drop_table("review_states")
    op.drop_table("progress")