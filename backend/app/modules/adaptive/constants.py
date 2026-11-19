"""Константы движка рекомендаций (алгоритм ``theme-mvp-1``).

Вынесены отдельно, потому что их читают и ядро, и слой БД, и админка: одна
цифра в двух местах — это рано или поздно два разных ответа на один вопрос.
"""

SCHEMA_VERSION = "1.0.0"
ALGORITHM_VERSION = "theme-mvp-1"

# Параметры окна и сглаживания холодного старта.
# XP за зачтённый самостоятельный правильный ответ (за уроки и кейсы).
XP_PER_COUNTED_ANSWER = 20

WINDOW_SIZE = 5
PRIOR_ERRORS = 2
PRIOR_ANSWERS = 4

# Ротация: после двух автоматических выдач подряд по одной теме третью не даём.
MAX_AUTO_TOPIC_STREAK = 2

# Редакционные веса тем: диапазон и шаг изменения.
WEIGHT_MIN_PCT = 80
WEIGHT_MAX_PCT = 120
WEIGHT_STEP_PCT = 5
INITIAL_CONFIG_VERSION = "weights-1"

# Статусы юридической проверки. Видимость — белый список: ``approved``
# показывается, черновики — только в песочнице, ``needs_recheck`` и
# ``retired`` не показываются никогда.
STATUS_DRAFT_PENDING = "draft_pending_expert_review"
STATUS_PENDING = "pending_expert_review"
STATUS_APPROVED = "approved"
STATUS_NEEDS_RECHECK = "needs_recheck"
STATUS_RETIRED = "retired"
DRAFT_STATUSES = {STATUS_DRAFT_PENDING, STATUS_PENDING}
STATUSES = DRAFT_STATUSES | {STATUS_APPROVED, STATUS_NEEDS_RECHECK, STATUS_RETIRED}

# Типы карточек: разбор для обучения, проверка урока, резервный кейс.
KIND_GUIDE = "guide"
KIND_LESSON_CHECK = "lesson_check"
KIND_RECOMMEND_CASE = "recommend_case"
SCORE_KINDS = {KIND_LESSON_CHECK, KIND_RECOMMEND_CASE}

# Режимы попытки и источник выдачи.
MODE_GUIDE = "guide"
MODE_CHECK = "check"
MODE_FRESH_CASE = "fresh_case"
MODE_PRACTICE = "practice"
ORIGIN_AUTO = "auto"
ORIGIN_MANUAL = "manual"
ORIGIN_LESSON = "lesson"

# Причины, которые видит клиент. Латиница — по контракту спецификации;
# человеческий текст собирает клиент, чтобы формулировки не жили в двух местах.
REASON_COUNTED = "COUNTED"
REASON_SKIP = "SKIP"
REASON_REVEAL = "REVEAL"
REASON_NOT_ASSESSMENT = "NOT_ASSESSMENT"
REASON_FAMILY_SEEN = "FAMILY_SEEN"
REASON_PRACTICE = "PRACTICE"
REASON_ASSISTED = "ASSISTED"
REASON_CONTENT_UNAVAILABLE = "CONTENT_UNAVAILABLE"
REASON_THEME_PRIORITY = "THEME_PRIORITY"
REASON_ROTATE_TOPIC = "ROTATE_TOPIC"
REASON_USER_TOPIC = "USER_TOPIC"
REASON_USER_LESSON = "USER_LESSON"
REASON_FRESH_EXHAUSTED = "FRESH_EXHAUSTED"
REASON_NO_PUBLISHED_CONTENT = "NO_PUBLISHED_CONTENT"
REASON_OPEN_ATTEMPT = "OPEN_ATTEMPT"

# Виды ответа выбора.
CHOICE_NEW_CASE = "new_case"
CHOICE_RESUME = "resume"
CHOICE_LESSON = "lesson"
CHOICE_REVIEW = "review"
CHOICE_CATALOG = "catalog"
CHOICE_NONE = "none"

# Метки состояния темы для интерфейса. Ни одной «освоено»: формула даёт
# приоритет практики, а не доказанное знание.
STATE_NOT_ASSESSED = "NOT_ASSESSED"
STATE_LIMITED = "LIMITED"
STATE_RECENT_RESULTS = "RECENT_RESULTS"
