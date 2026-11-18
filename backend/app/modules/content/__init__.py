"""Модуль контента: проверки ввода и сверка ответов.

Здесь остались только правила, не зависящие от старых таблиц:

* ``validation`` — админка не сохраняет нерешаемый кейс или вопрос;
* ``scoring`` — единственное место, где ответ сравнивается с эталоном.

Раньше модуль содержал ещё и хранение контента (``branches/lessons/cases``,
``lexbear_*``) и загрузчик JSON-паков. Этот контент заменён пакетом тем
(``app/content_packs/themes.json``): его проверяет ``app/modules/adaptive/pack.py``,
а отбор кейсов — ``app/modules/adaptive/engine.py``.
"""

from app.modules.content.validation import CaseIn, LessonIn, QuestionIn

__all__ = ["CaseIn", "LessonIn", "QuestionIn"]
