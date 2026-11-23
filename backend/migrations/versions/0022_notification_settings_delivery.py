"""notification settings and delivery log

Push-токены сохранялись, но отправлять по ним было нечем: кода, который
ходит в Expo Push API, в проекте не было. Кроме транспорта нужны две вещи:

* ``notification_settings`` — «Уведомления: Включены» в настройках было
  захардкоженным текстом, отключить пуши было нельзя;
* ``notification_deliveries`` — отметка «этому пользователю этот тип уже
  отправлен сегодня». Рассылку запускает cron, в compose два воркера, поэтому
  уникальный индекс (user_id, type, day) — единственная надёжная защита от
  дублей.

Revision ID: 0022
Revises: 0021
Create Date: 2026-11-17 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification_settings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "streak_reminders",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "daily_goal_reminders",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "review_reminders",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_notification_settings_user_id",
        "notification_settings",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "notification_deliveries",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "type",
            "day",
            name="uq_notification_delivery_user_type_day",
        ),
    )
    op.create_index(
        "ix_notification_deliveries_user_id",
        "notification_deliveries",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_notification_deliveries_user_id",
        table_name="notification_deliveries",
    )
    op.drop_table("notification_deliveries")
    op.drop_index(
        "ix_notification_settings_user_id",
        table_name="notification_settings",
    )
    op.drop_table("notification_settings")
