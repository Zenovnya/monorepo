"""content management: slug + is_active for JSON-driven content packs

Добавляет стабильные ключи (slug) для upsert уроков и кейсов и флаг мягкого
удаления (is_active) для юнитов, уроков, кейсов и статей. Это основа механизма
управления контентом: добавление/обновление по slug и «убавление» через
деактивацию без потери прогресса и истории SRS.

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-30 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- is_active (мягкое удаление). server_default=true → существующие
    #     строки становятся активными; затем убираем server_default, чтобы
    #     значение задавалось приложением. ---
    for table in ("units", "lexbear_lessons", "cases", "articles"):
        op.add_column(
            table,
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )
        op.alter_column(table, "is_active", server_default=None)

    # --- slug (стабильный ключ для upsert) на уроки и кейсы ---
    op.add_column(
        "lexbear_lessons",
        sa.Column("slug", sa.String(length=96), nullable=True),
    )
    op.create_index(
        "ix_lexbear_lessons_slug", "lexbear_lessons", ["slug"], unique=True
    )

    op.add_column(
        "cases",
        sa.Column("slug", sa.String(length=96), nullable=True),
    )
    op.create_index("ix_cases_slug", "cases", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_cases_slug", table_name="cases")
    op.drop_column("cases", "slug")

    op.drop_index("ix_lexbear_lessons_slug", table_name="lexbear_lessons")
    op.drop_column("lexbear_lessons", "slug")

    for table in ("articles", "cases", "lexbear_lessons", "units"):
        op.drop_column(table, "is_active")
