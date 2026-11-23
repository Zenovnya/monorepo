"""Состояние адаптивного обучения: темы, попытки, наблюдения

Появился модуль отбора кейсов (``app/modules/adaptive``): он решает, какой
кейс показать следующим, и помнит, что ученик уже видел. Без хранения это
состояние терялось бы при перезапуске, и ученик каждый раз начинал с первой
темы.

Ссылки на карточки — строки (``CIV01_R1``), а не внешние ключи: пак
версионируется целиком, и после его обновления строки с тем же id может уже
не быть. Вместе с id хранятся версия карточки и исходный ключ релиза, поэтому
старое наблюдение остаётся осмысленным.

``adaptive_attempts.id`` — строковый ключ ``a{seq}`` из движка. Он уникален
только внутри пользователя, но ``seq`` монотонен глобально по пользователю,
поэтому коллизий между пользователями нет.

Revision ID: 0025
Revises: 0024
Create Date: 2026-11-17 12:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

uuid = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "adaptive_states",
        sa.Column("id", uuid, primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            uuid,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("open_attempt_id", sa.String(32), nullable=True),
        sa.Column("release_key", sa.String(128), nullable=False),
        # Веса тем: JSON, потому что набор тем меняется вместе с паком.
        sa.Column("weights", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "weights_version", sa.String(32), nullable=False, server_default="weights-1"
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        sa.UniqueConstraint("user_id", name="uq_adaptive_state_user"),
    )
    op.create_index("ix_adaptive_states_user_id", "adaptive_states", ["user_id"])

    op.create_table(
        "adaptive_attempts",
        sa.Column("id", sa.String(32), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            uuid,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_id", sa.String(32), nullable=False),
        sa.Column("lesson_id", sa.String(32), nullable=False),
        sa.Column("topic_id", sa.String(16), nullable=False),
        sa.Column("subtopic_id", sa.String(64), nullable=False),
        sa.Column("evidence_family_id", sa.String(96), nullable=False),
        sa.Column("content_version", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("origin", sa.String(16), nullable=False),
        sa.Column("issued_seq", sa.Integer(), nullable=False),
        sa.Column("terminal_seq", sa.Integer(), nullable=True),
        sa.Column("preexposed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("assisted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("counted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reason", sa.String(32), nullable=True),
        sa.Column("selected_option_id", sa.String(8), nullable=True),
        sa.Column("correct", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')
        ),
    )
    op.create_index("ix_adaptive_attempts_user_id", "adaptive_attempts", ["user_id"])
    op.create_index("ix_adaptive_attempts_item_id", "adaptive_attempts", ["item_id"])
    op.create_index("ix_adaptive_attempts_topic_id", "adaptive_attempts", ["topic_id"])

    op.create_table(
        "adaptive_observations",
        sa.Column("id", uuid, primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            uuid,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Одна попытка даёт не больше одного наблюдения.
        sa.Column("attempt_id", sa.String(32), nullable=False, unique=True),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.String(16), nullable=False),
        sa.Column("subtopic_id", sa.String(64), nullable=False),
        sa.Column("item_id", sa.String(32), nullable=False),
        sa.Column("evidence_family_id", sa.String(96), nullable=False),
        sa.Column("content_version", sa.Integer(), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("voided", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')
        ),
    )
    op.create_index("ix_adaptive_observations_user_id", "adaptive_observations", ["user_id"])
    op.create_index("ix_adaptive_observations_topic_id", "adaptive_observations", ["topic_id"])

    op.create_table(
        "adaptive_seen_families",
        sa.Column("id", uuid, primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            uuid,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("family_id", sa.String(96), nullable=False),
        sa.UniqueConstraint("user_id", "family_id", name="uq_adaptive_seen_family"),
    )
    op.create_index("ix_adaptive_seen_families_user_id", "adaptive_seen_families", ["user_id"])

    op.create_table(
        "adaptive_topic_priorities",
        sa.Column("id", uuid, primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            uuid,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("topic_id", sa.String(16), nullable=False),
        sa.Column("n", sa.Integer(), nullable=False),
        sa.Column("errors", sa.Integer(), nullable=False),
        sa.Column("need", sa.Float(), nullable=False),
        sa.Column("priority", sa.Float(), nullable=False),
        sa.Column("state", sa.String(32), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        sa.UniqueConstraint("user_id", "topic_id", name="uq_adaptive_topic_priority"),
    )
    op.create_index(
        "ix_adaptive_topic_priorities_user_id", "adaptive_topic_priorities", ["user_id"]
    )


def downgrade() -> None:
    for table in (
        "adaptive_topic_priorities",
        "adaptive_seen_families",
        "adaptive_observations",
        "adaptive_attempts",
        "adaptive_states",
    ):
        op.drop_table(table)
