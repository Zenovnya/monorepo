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


class TestCurriculumPackCompleteness:
    """Юнит без уроков и урок без вопросов — дыра, которую видит пользователь.

    Раньше `КоАП: дорога` и `Трудовой кодекс` были объявлены неактивными с
    нулём уроков, а `uk-159-3-krupny` существовал как урок без карточек и
    вопросов: открыть его было можно, пройти — нельзя. Тест держит пак
    целым, чтобы это не вернулось при добавлении контента.
    """

    @staticmethod
    def _pack() -> dict:
        path = Path(__file__).resolve().parents[1] / "app" / "content_packs" / "curriculum.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def test_every_active_unit_has_lessons(self) -> None:
        pack = self._pack()
        empty = [
            unit["code"]
            for unit in pack["units"]
            if unit.get("is_active") and not unit.get("lessons")
        ]
        assert empty == [], f"активные юниты без уроков: {empty}"

    def test_every_lesson_has_cards_and_questions(self) -> None:
        pack = self._pack()
        broken = [
            lesson["slug"]
            for unit in pack["units"]
            for lesson in unit.get("lessons", [])
            if not lesson.get("cards") or not lesson.get("questions")
        ]
        assert broken == [], f"уроки без содержимого: {broken}"

    def test_question_correct_index_is_within_options(self) -> None:
        """`correct` указывает на индекс варианта: иначе вопрос нельзя решить."""
        pack = self._pack()
        problems = []
        for unit in pack["units"]:
            for lesson in unit.get("lessons", []):
                for question in lesson.get("questions", []):
                    options = question.get("options") or []
                    correct = question.get("correct")
                    if question.get("kind") in ("choice", "case", "truefalse"):
                        if not isinstance(correct, int) or not 0 <= correct < len(options):
                            problems.append((lesson["slug"], question.get("prompt")))
                    if not question.get("explanation"):
                        problems.append((lesson["slug"], "без разбора"))
        assert problems == []

    def test_lesson_slugs_are_unique(self) -> None:
        """Slug — ключ идемпотентного upsert: дубль молча перезапишет урок."""
        pack = self._pack()
        slugs = [
            lesson["slug"] for unit in pack["units"] for lesson in unit.get("lessons", [])
        ]
        assert len(slugs) == len(set(slugs))

    def test_content_matches_sections_in_unit_titles(self) -> None:
        """Каждый объявленный кодекс действительно наполнен."""
        pack = self._pack()
        totals = {
            unit["codex"]: sum(
                len(lesson.get("questions", [])) for lesson in unit.get("lessons", [])
            )
            for unit in pack["units"]
        }
        # КоАП и ТК раньше были пустыми — это была самая заметная дыра в
        # «карте обучения»: пользователь видел юнит и не мог ничего пройти.
        assert totals.get("КоАП", 0) >= 12
        assert totals.get("ТК", 0) >= 10
