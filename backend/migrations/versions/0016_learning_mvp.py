"""Add adaptive learning MVP tables."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

uuid = postgresql.UUID(as_uuid=True)


def _id(table, name="id"):
    return sa.Column(name, uuid, primary_key=True, nullable=False)


def upgrade() -> None:
    op.create_table("learning_domains", _id("learning_domains"), sa.Column("title", sa.String(255), nullable=False), sa.Column("slug", sa.String(128), nullable=False, unique=True))
    op.create_table("learning_topics", _id("learning_topics"), sa.Column("domain_id", uuid, sa.ForeignKey("learning_domains.id", ondelete="CASCADE"), nullable=False), sa.Column("title", sa.String(255), nullable=False), sa.Column("slug", sa.String(128), nullable=False), sa.UniqueConstraint("domain_id", "slug", name="uq_learning_topic_slug"))
    op.create_table("learning_competencies", _id("learning_competencies"), sa.Column("topic_id", uuid, sa.ForeignKey("learning_topics.id", ondelete="CASCADE"), nullable=False), sa.Column("title", sa.String(255), nullable=False), sa.Column("description", sa.Text()), sa.Column("importance", sa.Float(), nullable=False, server_default="1"), sa.Column("slug", sa.String(128), nullable=False), sa.UniqueConstraint("topic_id", "slug", name="uq_learning_competency_slug"))
    op.create_table("learning_competency_prerequisites", sa.Column("competency_id", uuid, sa.ForeignKey("learning_competencies.id", ondelete="CASCADE"), primary_key=True), sa.Column("prerequisite_id", uuid, sa.ForeignKey("learning_competencies.id", ondelete="CASCADE"), primary_key=True))
    op.create_table("learning_cases", _id("learning_cases"), sa.Column("title", sa.String(255), nullable=False), sa.Column("status", sa.String(32), nullable=False, server_default="draft"))
    op.create_table("learning_case_versions", _id("learning_case_versions"), sa.Column("case_id", uuid, sa.ForeignKey("learning_cases.id", ondelete="CASCADE"), nullable=False), sa.Column("version", sa.Integer(), nullable=False), sa.Column("situation", sa.Text(), nullable=False), sa.Column("difficulty", sa.Float(), nullable=False, server_default="0.5"), sa.Column("status", sa.String(32), nullable=False, server_default="draft"), sa.Column("published_at", sa.DateTime(timezone=True)), sa.UniqueConstraint("case_id", "version", name="uq_learning_case_version"))
    op.create_table("learning_case_steps", _id("learning_case_steps"), sa.Column("case_version_id", uuid, sa.ForeignKey("learning_case_versions.id", ondelete="CASCADE"), nullable=False), sa.Column("position", sa.Integer(), nullable=False), sa.Column("prompt", sa.Text(), nullable=False))
    op.create_table("learning_case_answers", _id("learning_case_answers"), sa.Column("step_id", uuid, sa.ForeignKey("learning_case_steps.id", ondelete="CASCADE"), nullable=False), sa.Column("text", sa.Text(), nullable=False), sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("explanation", sa.Text()), sa.Column("error_type", sa.String(64)))
    op.create_table("learning_case_competencies", sa.Column("case_version_id", uuid, sa.ForeignKey("learning_case_versions.id", ondelete="CASCADE"), primary_key=True), sa.Column("competency_id", uuid, sa.ForeignKey("learning_competencies.id", ondelete="CASCADE"), primary_key=True), sa.Column("weight", sa.Float(), nullable=False, server_default="1"))
    op.create_table("learning_assessment_sessions", _id("learning_assessment_sessions"), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_table("learning_attempts", _id("learning_attempts"), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("case_version_id", uuid, sa.ForeignKey("learning_case_versions.id"), nullable=False), sa.Column("step_id", uuid, sa.ForeignKey("learning_case_steps.id"), nullable=False), sa.Column("answer_id", uuid, sa.ForeignKey("learning_case_answers.id"), nullable=False), sa.Column("assessment_session_id", uuid, sa.ForeignKey("learning_assessment_sessions.id")), sa.Column("correct", sa.Boolean(), nullable=False), sa.Column("error_type", sa.String(64)), sa.Column("time_spent_seconds", sa.Integer(), nullable=False, server_default="0"), sa.Column("hints_used", sa.Integer(), nullable=False, server_default="0"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_table("learning_user_competency_states", _id("learning_user_competency_states"), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("competency_id", uuid, sa.ForeignKey("learning_competencies.id", ondelete="CASCADE"), nullable=False), sa.Column("mastery", sa.Float(), nullable=False, server_default="0"), sa.Column("confidence", sa.Float(), nullable=False, server_default="0"), sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"), sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"), sa.Column("last_seen", sa.DateTime(timezone=True)), sa.Column("next_review", sa.DateTime(timezone=True)), sa.UniqueConstraint("user_id", "competency_id", name="uq_learning_user_competency"))


def downgrade() -> None:
    for table in ("learning_user_competency_states", "learning_attempts", "learning_assessment_sessions", "learning_case_competencies", "learning_case_answers", "learning_case_steps", "learning_case_versions", "learning_cases", "learning_competency_prerequisites", "learning_competencies", "learning_topics", "learning_domains"):
        op.drop_table(table)