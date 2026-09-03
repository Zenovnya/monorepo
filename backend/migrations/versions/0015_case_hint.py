"""cases: add optional hint column for the "Подсказка" button

Мобильный экран прохождения кейса теперь показывает подсказку по кнопке.
Поле nullable — старые кейсы без подсказок продолжают работать; загрузчик
контент-паков заполняет hint для новых кейсов автоматически.

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-04 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cases", sa.Column("hint", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("cases", "hint")
