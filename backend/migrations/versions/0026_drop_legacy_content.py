"""Удаление старого контента: ветки, уроки, кейсы, статьи, адаптивный банк

Зачем удалять, а не «скрывать флагом»
-------------------------------------
Старый контент (6 юнитов, 40 уроков, 162 вопроса, 100 кейсов, статьи) был
признан неверным и непроверенным. Мягкое скрытие оставляет его в базе живым:
он продолжает приезжать в выгрузки, в статистику, в «повторения» у тех, у кого
уже есть история, и в любой момент возвращается одной ошибкой в фильтре. Пока
строки есть, кто-то однажды снова покажет их пользователю.

Что удаляется
-------------
Контент:

* ``articles``, ``learned_articles``, ``theory_cards``, ``questions``,
  ``lexbear_lessons``, ``units`` — уроки старого курса;
* ``cases``, ``case_options`` — 100 старых кейсов;
* ``branches``, ``lessons`` — дерево веток и уроков;
* ``learning_*`` (12 таблиц) — «адаптивный банк» прошлой итерации: кейсы,
  шаги, ответы, компетенции и сессии диагностики.

Прогресс по удалённому контенту:

* ``progress``, ``lexbear_progress`` — прогресс по урокам, которых больше нет;
* ``review_states``, ``review_logs`` — расписание повторений старых кейсов;
* ``daily_xp`` **остаётся**: это дневной счётчик опыта, он не привязан к
  контенту и нужен ежедневной цели.

Прогресс по этим урокам пропадает — это осознанное решение владельца, а не
побочный эффект: сохранять «достижения» за задания, которые признаны
неверными, значит и дальше показывать человеку неправду о его знаниях.

Новый контент живёт в файле (``app/content_packs/themes.json``), а состояние
адаптивного обучения — в таблицах ``adaptive_*`` (миграция 0025).

Revision ID: 0026
Revises: 0025
Create Date: 2026-11-17 14:00:00
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Порядок важен: сначала потомки, потом родители. На Postgres каскад бы сработал
# и сам, но явный порядок делает миграцию читаемой и безопасной на sqlite.
_DROP_ORDER = (
    # Сначала всё, что ссылается на контент, — потом сам контент.
    #
    # `ON DELETE CASCADE` управляет удалением СТРОК, а `DROP TABLE` требует,
    # чтобы в этот момент на таблицу не ссылался ни один внешний ключ. Поэтому
    # прогресс и повторения идут раньше `cases`/`lessons`, а `case_options` —
    # раньше `cases`. Порядок проверяется тестом
    # `tests/test_legacy_content_removed.py::test_drop_order_respects_foreign_keys`.
    "case_options",                      # -> cases
    "review_logs",                       # -> cases
    "review_states",                     # -> cases
    "progress",                          # -> lessons
    "lexbear_progress",                  # -> lexbear_lessons
    "cases",                             # <- case_options, review_*, progress
    "questions",                         # -> lexbear_lessons
    "theory_cards",                      # -> lexbear_lessons
    "learned_articles",                  # -> articles
    "articles",
    "lexbear_lessons",                   # <- lexbear_progress, questions, theory_cards
    "units",
    "lessons",                           # <- progress, branches
    "branches",
    # Адаптивный банк прошлой итерации: от потомков к родителям.
    "learning_case_competencies",        # -> learning_case_versions
    "learning_attempts",                 # -> learning_case_steps, case_answers, sessions
    "learning_case_answers",             # -> learning_case_steps
    "learning_case_steps",               # -> learning_case_versions
    "learning_assessment_sessions",
    "learning_case_versions",            # -> learning_cases
    "learning_cases",
    "learning_competency_prerequisites", # -> learning_competencies
    "learning_user_competency_states",   # -> learning_competencies
    "learning_competencies",             # -> learning_topics
    "learning_topics",                   # -> learning_domains
    "learning_domains",
)


def upgrade() -> None:
    for table in _DROP_ORDER:
        op.drop_table(table, if_exists=True)


def downgrade() -> None:
    """Восстановить старый контент нельзя.

    Таблицы удаляются вместе с данными, а содержимое старого пака (100 кейсов,
    40 уроков) из репозитория убрано: это был непроверенный контент. Обратная
    миграция создала бы пустые таблицы, которые выглядели бы как «контент
    пропал», — поэтому она намеренно не делает ничего.
    """
    pass
