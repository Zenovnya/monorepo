"""lives regeneration timestamp

Жизни были мёртвой механикой: `users.lives` уменьшался за ошибки в уроке
(`spend_lives`), но нигде не проверялся и никогда не восстанавливался.

* Урок начинался с любым числом жизней, включая ноль — то есть ограничения
  не существовало;
* обнулившийся счётчик оставался нулевым навсегда: единственный способ
  продолжить — купить «Пополнение жизней» за 50 гемов. Для бесплатного игрока
  это тупик, а сама покупка обещала восстановление того, что и так не мешало.

Теперь жизни восстанавливаются по одной за ``LIFE_REGEN_MINUTES`` (20 минут)
от момента последней траты. Для расчёта нужен этот момент — новая колонка
``users.lives_updated_at``.

Revision ID: 0023
Revises: 0022
Create Date: 2026-11-17 00:10:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("lives_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "lives_updated_at")
