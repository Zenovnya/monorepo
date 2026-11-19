"""Проверка зависимостей не должна расходиться с requirements.txt.

Реальный дефект, который это закрывает: скрипт `scripts/dev-start.ps1` держал
жёсткий список модулей. В нём не было PyJWT, поэтому шаг «Проверка
зависимостей» отвечал «всё есть», установка не запускалась, и падало уже на
миграциях с `ModuleNotFoundError: No module named 'jwt'`.

Теперь список читается из самого requirements.txt через
`scripts/check_deps.py`. Тест проверяет ровно то, что сломалось: PyJWT в
файле есть, и он попадает в проверяемые имена.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[2]
_SCRIPT = _ROOT / "scripts" / "check_deps.py"
_REQUIREMENTS = _ROOT / "backend" / "requirements.txt"


def _load_module():
    spec = importlib.util.spec_from_file_location("check_deps", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def check_deps():
    return _load_module()


def test_script_and_requirements_exist() -> None:
    assert _SCRIPT.is_file(), "нет scripts/check_deps.py — шаг 1 в .ps1 его вызывает"
    assert _REQUIREMENTS.is_file()


def test_pyjwt_is_checked(check_deps) -> None:
    """PyJWT обязан быть в списке проверки.

    Именно его отсутствие в жёстком списке и дало
    `ModuleNotFoundError: No module named 'jwt'` уже на миграциях.
    """
    names = check_deps.parse_requirement_names(_REQUIREMENTS.read_text(encoding="utf-8"))
    assert "PyJWT" in names


def test_runtime_packages_are_checked(check_deps) -> None:
    """Ключевые пакеты приложения проверяются все."""
    names = {name.lower() for name in
             check_deps.parse_requirement_names(_REQUIREMENTS.read_text(encoding="utf-8"))}
    for required in (
        "fastapi", "uvicorn", "sqlalchemy", "asyncpg", "alembic",
        "pydantic-settings", "bcrypt", "pyjwt", "redis",
    ):
        assert required in names, f"{required} выпал из проверки зависимостей"


def test_parser_strips_extras_versions_and_comments(check_deps) -> None:
    text = """
# комментарий
pydantic[email]>=2.5,<3.0
uvicorn[standard]>=0.30,<1.0
PyJWT>=2.10,<3.0
-r other.txt
--index-url https://example.com
sentry-sdk>=2.0,<3.0  # хвостовой комментарий
"""
    names = check_deps.parse_requirement_names(text)
    assert names == ["pydantic", "uvicorn", "PyJWT", "sentry-sdk"]


def test_reports_missing_package(check_deps) -> None:
    """Отсутствующий пакет попадает в отчёт — без падения на других."""
    missing = check_deps.missing_packages(["this-package-does-not-exist-xyz", "fastapi"])
    assert missing == ["this-package-does-not-exist-xyz"]


def test_installed_packages_are_found(check_deps) -> None:
    """PyJWT установлен в окружении тестов, а имя дистрибутива ≠ имя модуля."""
    assert check_deps.missing_packages(["PyJWT", "pydantic-settings"]) == []


def test_exit_code_reflects_result(tmp_path) -> None:
    """Код возврата — то, на что смотрит .ps1."""
    good = tmp_path / "good.txt"
    good.write_text("fastapi\n", encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(_SCRIPT), str(good)], capture_output=True, text=True
    )
    assert result.returncode == 0, result.stderr

    bad = tmp_path / "bad.txt"
    bad.write_text("fastapi\nnope-not-a-package-xyz\n", encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(_SCRIPT), str(bad)], capture_output=True, text=True
    )
    assert result.returncode == 1
    assert "nope-not-a-package-xyz" in result.stdout


def test_never_reports_false_success_on_empty_file(tmp_path) -> None:
    """Пустой файл — ошибка, а не «все пакеты установлены».

    Иначе опечатка в пути давала бы зелёный шаг и падение на миграциях.
    """
    empty = tmp_path / "empty.txt"
    empty.write_text("# только комментарий\n", encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(_SCRIPT), str(empty)], capture_output=True, text=True
    )
    assert result.returncode == 2
