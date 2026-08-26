"""add lexbear content tables (units, theory, questions, articles) and case fields

Revision ID: 0010
Revises: 0009
Create Date: 2026-01-01 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Юниты (острова обучения) ---
    op.create_table(
        "units",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=64), nullable=False, unique=True),
        sa.Column("codex", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("subtitle", sa.String(length=255), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#C9A227"),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("why_practical", sa.Text(), nullable=False, server_default=""),
    )

    # --- Уроки LexBear ---
    op.create_table(
        "lexbear_lessons",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("unit_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("xp_reward", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.ForeignKeyConstraint(["unit_id"], ["units.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_lexbear_lessons_unit_id", "lexbear_lessons", ["unit_id"])

    # --- Карточки теории ---
    op.create_table(
        "theory_cards",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("definition", sa.Text(), nullable=False),
        sa.Column("practical", sa.Text(), nullable=False),
        sa.Column("chips", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("bear_line", sa.Text(), nullable=False, server_default=""),
        sa.ForeignKeyConstraint(["lesson_id"], ["lexbear_lessons.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_theory_cards_lesson_id", "theory_cards", ["lesson_id"])

    # --- Вопросы/задания урока ---
    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("case_text", sa.Text(), nullable=True),
        sa.Column("options", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("correct", sa.JSON(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False, server_default=""),
        sa.ForeignKeyConstraint(["lesson_id"], ["lexbear_lessons.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_questions_lesson_id", "questions", ["lesson_id"])

    # --- Справочник статей ---
    op.create_table(
        "articles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=64), nullable=False, unique=True),
        sa.Column("codex", sa.String(length=32), nullable=False),
        sa.Column("number", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("plain", sa.Text(), nullable=False),
        sa.Column("full", sa.Text(), nullable=False),
    )

    # --- Изученные статьи пользователя ---
    op.create_table(
        "learned_articles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("article_id", sa.Integer(), nullable=False),
        sa.Column(
            "learned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "article_id", name="learned_user_article_uq"),
    )
    op.create_index("ix_learned_articles_user_id", "learned_articles", ["user_id"])

    # --- Расширяем существующую таблицу cases полями LexBear (вкладка «Кейсы») ---
    op.add_column(
        "cases",
        sa.Column("title", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "cases",
        sa.Column("codex", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "cases",
        sa.Column("difficulty", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "cases",
        sa.Column("case_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "cases",
        sa.Column("correct", sa.Integer(), nullable=True),
    )
    op.add_column(
        "cases",
        sa.Column("featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("cases", "featured")
    op.drop_column("cases", "correct")
    op.drop_column("cases", "case_text")
    op.drop_column("cases", "difficulty")
    op.drop_column("cases", "codex")
    op.drop_column("cases", "title")

    op.drop_index("ix_learned_articles_user_id", table_name="learned_articles")
    op.drop_table("learned_articles")
    op.drop_table("articles")
    op.drop_index("ix_questions_lesson_id", table_name="questions")
    op.drop_table("questions")
    op.drop_index("ix_theory_cards_lesson_id", table_name="theory_cards")
    op.drop_table("theory_cards")
    op.drop_index("ix_lexbear_lessons_unit_id", table_name="lexbear_lessons")
    op.drop_table("lexbear_lessons")
    op.drop_table("units")