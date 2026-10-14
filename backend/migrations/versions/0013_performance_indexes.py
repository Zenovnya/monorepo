"""add performance indexes (dates and statuses)

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-01 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Поиск по дате в истории платежей (аналитика, выписки) — частые запросы.
    op.create_index(
        "ix_payment_history_created_at",
        "payment_history",
        ["created_at"],
    )

    # Поиск активных подписок по статусу и сроку действия.
    op.create_index(
        "ix_subscriptions_status",
        "subscriptions",
        ["status"],
    )
    op.create_index(
        "ix_subscriptions_expires_at",
        "subscriptions",
        ["expires_at"],
    )

    # Поиск пользователей по последнему дню активности (стрики, рассылки).
    op.create_index(
        "ix_users_last_active_day",
        "users",
        ["last_active_day"],
    )

    # Поиск транзакций по платёжному id ЮKassa (для webhook-обработки).
    op.create_index(
        "ix_payment_history_yookassa_payment_id",
        "payment_history",
        ["yookassa_payment_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_payment_history_yookassa_payment_id", table_name="payment_history")
    op.drop_index("ix_users_last_active_day", table_name="users")
    op.drop_index("ix_subscriptions_expires_at", table_name="subscriptions")
    op.drop_index("ix_subscriptions_status", table_name="subscriptions")
    op.drop_index("ix_payment_history_created_at", table_name="payment_history")