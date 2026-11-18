"""hash stored refresh tokens (sha256) instead of keeping them in plaintext

``refresh_tokens.token`` хранил JWT как есть. Любая утечка дампа БД (бэкап,
read-only креды, будущая инъекция) давала рабочие refresh-токены всех
пользователей — то есть захват аккаунтов без взлома пароля.

Приложение теперь ищет запись по ``sha256(value)``. Чтобы существующие сессии
продолжили работать, конвертируем уже сохранённые значения: вычисляем SHA-256
от текущей строки и записываем хеш на её место. Клиенты ничего не заметят —
они по-прежнему присылают исходный JWT, а сервер хеширует его при поиске.

Значения длиной ровно 64 символа в hex-алфавите считаем уже
конвертированными и повторно не трогаем (миграция идемпотентна).

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-18 00:00:00
"""

import hashlib
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_HEX = set("0123456789abcdef")


def _looks_hashed(value: str) -> bool:
    """True, если значение уже похоже на sha256-hex."""
    if not isinstance(value, str) or len(value) != 64:
        return False
    return set(value.lower()) <= _HEX


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id, token FROM refresh_tokens")
    ).fetchall()

    for row_id, token in rows:
        if _looks_hashed(token):
            continue
        hashed = hashlib.sha256(str(token).encode("utf-8")).hexdigest()
        connection.execute(
            sa.text("UPDATE refresh_tokens SET token = :token WHERE id = :id"),
            {"token": hashed, "id": row_id},
        )


def downgrade() -> None:
    """Откат невозможен: из хеша нельзя восстановить исходный токен.

    Единственный корректный путь назад — разлогинить всех, иначе таблица
    останется в состоянии, где приложение ищет plaintext, а лежит хеш.
    """
    op.execute(sa.text("DELETE FROM refresh_tokens"))
