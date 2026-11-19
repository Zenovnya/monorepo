"""Проверка, что все пакеты из backend/requirements.txt установлены.

Зачем отдельный файл, а не `python -c 'import ...'` в PowerShell:

1. Жёсткий список модулей расходится с requirements.txt. Так и случилось:
   в списке проверки было семь имён, а PyJWT в него не попал — шаг
   «Проверка зависимостей» отвечал «всё есть», установка не запускалась,
   и падало уже на миграциях с `ModuleNotFoundError: No module named 'jwt'`.
   Здесь список не дублируется: читается сам файл требований.

2. Имена дистрибутивов и модулей не совпадают: `PyJWT` — это `jwt`,
   `pydantic-settings` — `pydantic_settings`, `sentry-sdk` — `sentry_sdk`.
   Проверка по `importlib.metadata` работает с именами из файла, поэтому
   переводить их вручную не нужно и ошибиться негде.

3. Это можно проверить тестом — в отличие от кода на PowerShell.

Запуск: python scripts/check_deps.py [путь_к_requirements.txt]
Код возврата: 0 — всё установлено, 1 — чего-то не хватает (имена в stdout).
"""

from __future__ import annotations

import re
import sys
from importlib import metadata
from pathlib import Path

# Строки требований, которые не являются пакетами.
_IGNORED_PREFIXES = ("-r", "-e", "--", "#", "git+", "http://", "https://")


def parse_requirement_names(text: str) -> list[str]:
    """Возвращает имена дистрибутивов из requirements.txt.

    Отбрасывает комментарии, опции pip и ссылки; срезает extras и версии:
    ``pydantic[email]>=2.5,<3.0`` → ``pydantic``.
    """
    names: list[str] = []
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or line.startswith(_IGNORED_PREFIXES):
            continue
        # Имя — всё до первого разделителя версии или extras.
        match = re.match(r"([A-Za-z0-9][A-Za-z0-9._-]*)", line)
        if match:
            names.append(match.group(1))
    return names


def missing_packages(names: list[str]) -> list[str]:
    """Пакеты, которых нет в текущем окружении. Регистр не важен для metadata."""
    missing = []
    for name in names:
        try:
            metadata.version(name)
        except metadata.PackageNotFoundError:
            missing.append(name)
    return missing


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else (
        Path(__file__).resolve().parent.parent / "backend" / "requirements.txt"
    )
    if not path.exists():
        print(f"не найден файл требований: {path}", file=sys.stderr)
        return 2

    names = parse_requirement_names(path.read_text(encoding="utf-8"))
    if not names:
        print(f"в {path} не найдено ни одного пакета", file=sys.stderr)
        return 2

    missing = missing_packages(names)
    if missing:
        # По одному в строке: PowerShell-скрипт собирает их в сообщение.
        print("\n".join(missing))
        return 1
    print(f"все {len(names)} пакетов установлены")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
