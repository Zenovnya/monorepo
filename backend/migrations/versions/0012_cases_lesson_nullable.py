"""make cases.lesson_id nullable (standalone LexBear cases)

Revision ID: 0012
Revises: 0011
Create Date: 2026-01-01 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Кейсы вкладки «Кейсы» не привязаны к уроку — ослабляем ограничение.
    op.alter_column("cases", "lesson_id", existing_type=sa.dialects.postgresql.UUID(as_uuid=True), nullable=True)


def downgrade() -> None:
    op.alter_column("cases", "lesson_id", existing_type=sa.dialects.postgresql.UUID(as_uuid=True), nullable=False)