"""Старый контент удалён физически, а не скрыт флагом.

Пользователь признал прежние 100 кейсов и 40 уроков непроверенными, и решение
было — удалить, а не прятать. Разница важна: скрытые строки продолжают жить в
базе, попадать в выгрузки и возвращаться одной ошибкой в фильтре. Поэтому
тест проверяет отсутствие таблиц, файлов и маршрутов, а не «флаг is_active».
"""

from __future__ import annotations

from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]

# Таблицы старого контента и прогресса по нему.
LEGACY_TABLES = {
    "branches",
    "lessons",
    "cases",
    "case_options",
    "units",
    "lexbear_lessons",
    "theory_cards",
    "questions",
    "articles",
    "learned_articles",
    "lexbear_progress",
    "progress",
    "review_states",
    "review_logs",
    "learning_cases",
    "learning_case_versions",
    "learning_competencies",
    "learning_domains",
    "learning_topics",
}


def _metadata_tables() -> set[str]:
    import app.main  # noqa: F401  — регистрирует модели
    from app.database import Base

    return set(Base.metadata.tables)


def test_legacy_tables_are_not_in_metadata() -> None:
    tables = _metadata_tables()
    assert not LEGACY_TABLES & tables, LEGACY_TABLES & tables
    # Состояние нового движка на месте — «удалили всё» не считается успехом.
    assert {
        "adaptive_states",
        "adaptive_attempts",
        "adaptive_observations",
        "adaptive_seen_families",
        "adaptive_topic_priorities",
    } <= tables


def test_legacy_packs_are_gone() -> None:
    packs = BACKEND / "app" / "content_packs"
    for name in ("cases.json", "curriculum.json", "articles.json"):
        assert not (packs / name).exists(), name
    assert (packs / "themes.json").exists()


def _sources(folder: Path) -> list[Path]:
    """Исходники модуля. ``__pycache__`` переживает удаление кода, поэтому каталог
    сам по себе ничего не доказывает — проверяем именно ``*.py``."""
    return [path for path in folder.glob("*.py")] if folder.exists() else []


def test_legacy_modules_are_gone() -> None:
    for folder in ("learning", "srs"):
        assert not _sources(BACKEND / "app" / "modules" / folder), folder
    for name in ("lexbear_service.py", "lexbear_models.py", "content_loader.py", "police_unit.py"):
        assert not (BACKEND / "app" / "modules" / "content" / name).exists(), name


def test_migration_0026_drops_them() -> None:
    """Миграция должна удалять ровно эти таблицы, иначе БД разойдётся с моделями."""
    import importlib.util

    path = BACKEND / "migrations" / "versions" / "0026_drop_legacy_content.py"
    spec = importlib.util.spec_from_file_location("m0026", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.down_revision == "0025"
    dropped = set(module._DROP_ORDER)
    assert LEGACY_TABLES <= dropped, LEGACY_TABLES - dropped
    # Дневной счётчик XP нужен ежедневной цели и к контенту не относится.
    assert "daily_xp" not in dropped


@pytest.mark.parametrize(
    "path",
    ["/lexbear/cases", "/content/branches", "/learning/next", "/progress", "/srs/reviews"],
)
def test_legacy_routes_are_not_served(client, path) -> None:
    """Маршрутов старого контента нет. 404, а не 401: их не существует."""
    response = client.get(path)
    assert response.status_code == 404, response.text
