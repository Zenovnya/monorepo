"""seed mascot_phrases so /mascot/phrase/{trigger} never 400s on a fresh DB

``GET /mascot/phrase/{trigger}`` возвращает 400, если для триггера нет активных
фраз: ``mascot_phrases`` заполнялась только отдельным (не автоматическим)
скриптом. На пустой БД мишка молчит и спамит ошибками в консоли клиента.

Миграция наполняет таблицу базовыми фразами для всех значений
``VALID_TRIGGERS``. Вставка идемпотентна по тексту фразы — повторный прогон
ничего не дублирует, а контент, добавленный редактором, не перезаписывается.

Revision ID: 0018
Revises: 0017
Create Date: 2026-11-01 00:00:00
"""

from typing import Sequence, Union

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (trigger, emotion, phrase, weight, sort_order)
PHRASES: list[tuple[str, str, str, int, int]] = [
    ("greeting", "happy", "Привет! Я Лёва. Разберёмся с законом без паники.", 1, 10),
    ("greeting", "idle", "С возвращением. Продолжим с того места, где остановились?", 1, 20),
    ("greeting", "happy", "Добрый вечер. Пять минут теории — и ты уже спокойнее.", 1, 30),
    ("pet", "happy", "Мурр. То есть — ррр. Приятно!", 1, 10),
    ("pet", "idle", "Я рядом. Если что — подскажу, где твои права.", 1, 20),
    ("pet", "happy", "Ещё разок? Ну ладно, я не против.", 1, 30),
    ("pet", "wrong_sad", "Ничего страшного. Ошибаться — это часть учёбы.", 1, 40),
    ("case_correct", "celebrate", "Верно! Ты только что защитил себя знанием закона.", 1, 10),
    ("case_correct", "celebrate", "Ещё один верный ответ. Так и набирается уверенность.", 1, 20),
    ("case_correct", "happy", "Точно в цель. Запомни этот ход — он пригодится.", 1, 30),
    ("case_wrong", "wrong_sad", "Не угадал. Давай разберём, почему так нельзя.", 1, 10),
    ("case_wrong", "idle", "Ошибка — это данные, а не приговор. Смотрим разбор.", 1, 20),
    ("case_wrong", "wrong_sad", "Спокойно. Следующий кейс разберём вместе.", 1, 30),
    ("app_first_open", "happy", "Первый шаг сделан. Я Лёва, твой проводник в праве.", 1, 10),
    ("app_first_open", "idle", "Начнём с базовых прав — это фундамент всего остального.", 1, 20),
]


def upgrade() -> None:
    phrases = sa.table(
        "mascot_phrases",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("trigger", sa.String),
        sa.column("emotion", sa.String),
        sa.column("phrase", sa.Text),
        sa.column("weight", sa.Integer),
        sa.column("sort_order", sa.Integer),
        sa.column("show_once", sa.Boolean),
        sa.column("is_active", sa.Boolean),
    )

    conn = op.get_bind()
    existing = {
        row[0]
        for row in conn.execute(sa.text("SELECT phrase FROM mascot_phrases")).fetchall()
    }

    rows = [
        {
            # server_default на id в таблице нет — UUID генерируем здесь.
            "id": uuid.uuid4(),
            "trigger": trigger,
            "emotion": emotion,
            "phrase": phrase,
            "weight": weight,
            "sort_order": sort_order,
            "show_once": False,
            "is_active": True,
        }
        for trigger, emotion, phrase, weight, sort_order in PHRASES
        if phrase not in existing
    ]
    if rows:
        op.bulk_insert(phrases, rows)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM mascot_phrases WHERE phrase = ANY(:phrases)"),
        {"phrases": [phrase for _, _, phrase, _, _ in PHRASES]},
    )
