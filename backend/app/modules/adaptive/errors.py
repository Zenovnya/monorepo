"""Ошибки движка рекомендаций.

Отдельный модуль, чтобы ``pack`` и ``engine`` могли бросать одну и ту же
ошибку без циклического импорта.
"""

from __future__ import annotations


class EngineError(Exception):
    """Нарушение контракта: клиент прислал то, чего сервер не допускает.

    Сообщение — код из спецификации (``BAD_OPTION``, ``OPEN_ATTEMPT``), а не
    текст для человека: код проверяется тестами, текст переводит клиент.
    """


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise EngineError(reason)
