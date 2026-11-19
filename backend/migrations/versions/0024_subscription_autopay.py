"""subscription payment method and auto-renew

Перед публикацией подписка была «односторонней»: магазин мог списать деньги
по сохранённому способу оплаты, а приложение не хранило ни сам идентификатор
способа, ни признак того, что автосписания включены. Следствия:

* удаление аккаунта не отменяло автоплатёж — деньги продолжали приходить на
  аккаунт, которого больше нет;
* пользователь не мог отказаться от продления, сохранив оплаченный доступ.

Теперь ``subscriptions`` помнит ``payment_method_id`` (у ЮKassa это
``payment_method.id``; удаление этого идентификатора у себя и есть отключение
автосписаний — отдельного API удаления у шлюза нет) и флаг ``auto_renew``.

Revision ID: 0024
Revises: 0023
Create Date: 2026-11-17 00:40:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("payment_method_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "auto_renew",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "auto_renew")
    op.drop_column("subscriptions", "payment_method_id")
