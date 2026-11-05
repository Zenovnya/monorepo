"""learning_case_versions: source slug + legal review status

Импорт кейсов из JSON-пака (``app/content_packs/cases.json``) идемпотентен по
``source_slug``, поэтому нужен стабильный ключ, отличный от UUID. Импорт НЕ
означает юридическую проверку — статус проверки хранится отдельно.

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-31 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "learning_case_versions",
        sa.Column("source_slug", sa.String(96), nullable=True),
    )
    op.add_column(
        "learning_case_versions",
        sa.Column(
            "review_status",
            sa.String(32),
            nullable=False,
            server_default="imported",
        ),
    )
    op.add_column(
        "learning_case_versions",
        sa.Column("reviewed_by", sa.String(128), nullable=True),
    )
    op.add_column(
        "learning_case_versions",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_learning_case_versions_source_slug",
        "learning_case_versions",
        ["source_slug"],
        unique=True,
    )
    op.create_index(
        "ix_learning_case_versions_review_status",
        "learning_case_versions",
        ["review_status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_learning_case_versions_review_status",
        table_name="learning_case_versions",
    )
    op.drop_index(
        "ix_learning_case_versions_source_slug",
        table_name="learning_case_versions",
    )
    op.drop_column("learning_case_versions", "reviewed_at")
    op.drop_column("learning_case_versions", "reviewed_by")
    op.drop_column("learning_case_versions", "review_status")
    op.drop_column("learning_case_versions", "source_slug")
