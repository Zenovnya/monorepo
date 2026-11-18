"""Проверка и «прогрев» пака при старте.

Отдельного сида в БД нет намеренно. Контент — это файл, который версионируется
целиком (``pack_id@version``), и его единственная копия живёт в
``app/content_packs/themes.json``. Копия в таблицах неизбежно разъехалась бы с
файлом: часть правок попала бы в БД, часть — в файл, и никто не смог бы
сказать, какая из них настоящая. Поэтому:

* при старте пак **проверяется** — битый контент должен ломать деплой, а не
  экран пользователя;
* прогресс (попытки, наблюдения) живёт в БД и ссылается на id карточек.

Функция возвращает сводку, чтобы её можно было показать в админке и в логах.
"""

from __future__ import annotations

from typing import Any

from app.modules.adaptive.errors import EngineError
from app.modules.adaptive.pack import Pack, load_pack, validate


def check_pack(pack: Pack | None = None) -> dict[str, Any]:
    """Проверяет пак и возвращает сводку. Бросает ``EngineError`` при ошибке."""
    pack = pack or load_pack()
    validate(pack)
    return {
        "release_key": pack.release_key,
        "topics": len(pack.topics),
        "lessons": len(pack.lessons),
        "items": len(pack.items),
        "legal_authorities": len(pack.authorities),
        "editorial_note": pack.editorial_note,
    }


__all__ = ["EngineError", "check_pack"]


if __name__ == "__main__":  # pragma: no cover — точка входа для CI
    import json

    try:
        print(json.dumps(check_pack(), ensure_ascii=False, indent=2))
    except EngineError as exc:
        # Ненулевой код возврата: битый пак должен остановить деплой.
        print(f"ПАКЕТ НЕ ПРОШЁЛ ПРОВЕРКУ: {exc}")
        raise SystemExit(1) from exc
