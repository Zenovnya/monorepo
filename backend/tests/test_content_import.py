"""Тесты импортёра кейсов: чистые проверки пака и валидации.

Проверки, которым нужна БД (идемпотентность, статусы проверки), лежат в
``test_content_import_db.py`` — они требуют ``DATABASE_URL``.
"""

import json
from pathlib import Path

import pytest

from app.modules.learning import importer
from app.modules.learning.models import CaseAnswer, CaseStep, CaseVersion, LearningCase

PACK = {
    "cases": [
        {
            "slug": "return-of-complex-goods",
            "title": "Возврат технически сложного товара",
            "codex": "ЗОЗПП",
            "difficulty": "medium",
            "case_text": "Товар сломался на 20-й день.",
            "featured": True,
            "hint": "Смотри ст. 18 закона о защите прав потребителей.",
            "options": [
                {"text": "Требовать замену", "is_correct": False, "explanation": "Нет"},
                {
                    "text": "Отказаться от договора",
                    "is_correct": True,
                    "explanation": "Да",
                },
                {"text": "Ничего не делать", "is_correct": False, "explanation": "Нет"},
            ],
        },
        {
            "slug": "police-document-check",
            "title": "Проверка документов",
            "codex": "КоАП",
            "difficulty": "hard",
            "case_text": "Сотрудник просит предъявить документы.",
            "options": [
                {
                    "text": "Уточнить основание",
                    "is_correct": True,
                    "explanation": "Нужно",
                },
                {"text": "Убежать", "is_correct": False, "explanation": "Риск"},
            ],
        },
    ]
}


@pytest.fixture()
def packs_dir(tmp_path: Path) -> Path:
    """Пак с уникальными для теста slug (чтобы данные в БД не конфликтовали)."""
    import uuid

    suffix = uuid.uuid4().hex[:8]
    pack = json.loads(json.dumps(PACK))
    for case in pack["cases"]:
        case["slug"] = f"{case['slug']}-{suffix}"
    (tmp_path / "cases.json").write_text(
        json.dumps(pack, ensure_ascii=False), encoding="utf-8"
    )
    return tmp_path


def test_difficulty_label_is_normalised() -> None:
    assert importer.difficulty_to_float("easy") == 0.3
    assert importer.difficulty_to_float("HARD") == 0.8
    assert importer.difficulty_to_float("unknown") == importer.DEFAULT_DIFFICULTY
    assert importer.difficulty_to_float(1.7) == 1.0
    assert importer.difficulty_to_float(-1) == 0.0


def test_case_without_single_correct_option_is_rejected() -> None:
    bad = {
        "slug": "no-correct",
        "title": "Без правильного варианта",
        "codex": "ГК",
        "case_text": "Текст",
        "options": [
            {"text": "A", "is_correct": False},
            {"text": "B", "is_correct": False},
        ],
    }
    with pytest.raises(importer.ContentImportError, match="ровно один правильный"):
        importer.validate_case(bad, 0)


def test_case_without_slug_is_rejected() -> None:
    with pytest.raises(importer.ContentImportError, match="нет slug"):
        importer.validate_case({"title": "x", "case_text": "y", "options": []}, 3)


def test_case_with_too_few_options_is_rejected() -> None:
    bad = {
        "slug": "one-option",
        "title": "Один вариант",
        "codex": "ГК",
        "case_text": "Текст",
        "options": [{"text": "A", "is_correct": True}],
    }
    with pytest.raises(importer.ContentImportError, match="меньше двух вариантов"):
        importer.validate_case(bad, 0)


def test_missing_pack_is_treated_as_empty(tmp_path: Path) -> None:
    assert importer.read_cases_pack(tmp_path) == []


pack = json.loads(json.dumps(PACK))


class TestCaseInValidation:
    """Валидация ``codex``/``case_text`` в схеме кейса.

    Пустой ``codex`` проходил схему, кейс сохранялся в админке, но
    ``GET /lexbear/cases`` такие кейсы молча отфильтровывал: контент
    «терялся» без единой ошибки.
    """

    BASE = {
        "slug": "case-1",
        "title": "Кейс",
        "difficulty": "easy",
        "options": [{"text": "Да", "is_correct": True}, {"text": "Нет"}],
    }

    def test_valid_codex_normalized(self) -> None:
        from app.modules.content.content_schemas import CaseIn

        case = CaseIn(**self.BASE, codex="  ГК РФ  ", case_text="  Текст  ")
        assert case.codex == "ГК РФ"
        assert case.case_text == "Текст"

    @pytest.mark.parametrize(
        "field,value",
        [
            ("codex", ""),
            ("codex", "   "),
            ("case_text", ""),
            ("case_text", "   "),
            ("title", "  "),
        ],
    )
    def test_blank_required_fields_rejected(self, field: str, value: str) -> None:
        from pydantic import ValidationError

        from app.modules.content.content_schemas import CaseIn

        payload = {**self.BASE, "codex": "ГК РФ", "case_text": "Текст"}
        payload[field] = value
        with pytest.raises(ValidationError):
            CaseIn(**payload)


def test_seed_runs_in_single_event_loop() -> None:
    """Сид контента должен выполняться в одном event loop.

    Регрессия: `python -m app.seed` вызывал `asyncio.run()` дважды
    (отдельно learning и lexbear). Асинхронный пул SQLAlchemy живёт на уровне
    процесса, asyncpg-соединения привязаны к конкретному loop, и во втором
    прогоне падали с «got Future attached to a different loop». На sqlite
    (локальные тесты) не воспроизводилось, на Postgres (CI и прод) — всегда,
    то есть сид контента в проде не работал.
    """
    import inspect

    from app import seed

    assert inspect.iscoroutinefunction(seed.seed_all)

    source = inspect.getsource(seed)
    # Внутри `if __name__ == "__main__"` ровно один asyncio.run.
    main_block = source.split('if __name__ == "__main__":')[1]
    assert main_block.count("asyncio.run(") == 1
    assert "seed_all()" in main_block
