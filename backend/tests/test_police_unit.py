"""Тесты флагманского юнита «Общение с полицией».

Проверяют, что генератор ``police_unit`` даёт валидный по схеме ``UnitIn``
юнит ровно из 25 уроков / 125 вопросов и что он действительно лежит в
``curriculum.json`` (иначе ``python -m app.modules.content.police_unit``
забыли запустить после правки).
"""

import json
from pathlib import Path

import pytest

from app.modules.content.content_loader import _read_pack
from app.modules.content.content_schemas import CurriculumPack, UnitIn
from app.modules.content.police_unit import POLICE_UNIT, police_lessons, police_unit

PACKS_DIR = Path(__file__).resolve().parents[1] / "app" / "content_packs"

EXPECTED_LESSONS = 25
EXPECTED_QUESTIONS = 125


@pytest.fixture(scope="module")
def unit() -> UnitIn:
    return UnitIn.model_validate(police_unit())


def test_unit_matches_schema(unit: UnitIn) -> None:
    """Юнит проходит валидацию ``UnitIn`` и имеет ожидаемый код."""
    assert unit.code == POLICE_UNIT["code"] == "police"
    assert unit.title == "Общение с полицией"


def test_lesson_and_question_counts(unit: UnitIn) -> None:
    """Ровно 25 уроков и 125 вопросов — по 5 на урок."""
    assert len(unit.lessons) == EXPECTED_LESSONS
    assert sum(len(lesson.questions) for lesson in unit.lessons) == EXPECTED_QUESTIONS
    assert all(len(lesson.questions) == 5 for lesson in unit.lessons)


def test_lesson_orders_are_sequential_and_slugs_unique(unit: UnitIn) -> None:
    """Порядок уроков 1..25 без пропусков, slug'и уникальны."""
    assert [lesson.order for lesson in unit.lessons] == list(
        range(1, EXPECTED_LESSONS + 1)
    )
    slugs = [lesson.slug for lesson in unit.lessons]
    assert len(set(slugs)) == len(slugs)
    assert all(slug.startswith("police-") for slug in slugs)


def test_every_question_has_valid_single_choice(unit: UnitIn) -> None:
    """У каждого вопроса kind из {choice, case} и корректный индекс ответа."""
    for lesson in unit.lessons:
        for question in lesson.questions:
            assert question.kind in {"choice", "case"}, question.prompt
            assert len(question.options) >= 2, question.prompt
            correct = question.correct
            assert isinstance(correct, int), question.prompt
            assert 0 <= correct < len(question.options), question.prompt
            assert question.explanation, question.prompt
            if question.kind == "case":
                assert question.case_text, question.prompt
            else:
                assert question.case_text is None, question.prompt


def test_every_lesson_has_theory_cards(unit: UnitIn) -> None:
    """У каждого урока есть теория с заполненными полями."""
    for lesson in unit.lessons:
        assert len(lesson.cards) >= 3, lesson.slug
        for card in lesson.cards:
            assert card.title and card.definition, lesson.slug
            assert card.chips, lesson.slug
            assert card.bear_line, lesson.slug


def test_lessons_are_order_sorted() -> None:
    """``police_lessons()`` возвращает уроки уже отсортированными."""
    orders = [lesson["order"] for lesson in police_lessons()]
    assert orders == sorted(orders)


def test_unit_is_present_in_curriculum_pack() -> None:
    """Сгенерированный юнит записан в ``curriculum.json`` и пак валиден."""
    pack = CurriculumPack(**_read_pack(PACKS_DIR, "curriculum.json"))
    police = [pack_unit for pack_unit in pack.units if pack_unit.code == "police"]
    assert len(police) == 1, "юнит 'police' должен быть в паке ровно один раз"

    saved = police[0]
    assert len(saved.lessons) == EXPECTED_LESSONS
    assert sum(len(lesson.questions) for lesson in saved.lessons) == EXPECTED_QUESTIONS

    generated = unit_for_comparison()
    assert saved.model_dump() == generated, (
        "curriculum.json устарел — запустите "
        "python -m app.modules.content.police_unit"
    )


def unit_for_comparison() -> dict:
    """Сериализованный вид сгенерированного юнита для сравнения с паком."""
    return json.loads(UnitIn.model_validate(police_unit()).model_dump_json())


def test_police_unit_is_active(unit: UnitIn) -> None:
    """Флагманский юнит включён и отдаётся клиенту."""
    assert unit.is_active is True


def test_empty_units_are_disabled_in_pack() -> None:
    """Пустой юнит без уроков не должен доезжать до клиента.

    ``list_units()`` фильтрует по ``Unit.is_active``, поэтому юнит с нулём
    уроков обязан быть выключен в паке — иначе пользователь увидит пустой остров.
    """
    pack = CurriculumPack(**_read_pack(PACKS_DIR, "curriculum.json"))
    empty = [pack_unit for pack_unit in pack.units if not pack_unit.lessons]

    assert all(not pack_unit.is_active for pack_unit in empty), (
        "пустые юниты должны иметь is_active=false: "
        + ", ".join(pack_unit.code for pack_unit in empty if pack_unit.is_active)
    )


def test_unit_orders_are_unique_in_pack() -> None:
    """Порядок юнитов уникален.

    ``list_units()`` сортирует по ``Unit.order`` без вторичного ключа, поэтому
    совпадающие значения дают нестабильный порядок островов на клиенте.
    """
    pack = CurriculumPack(**_read_pack(PACKS_DIR, "curriculum.json"))
    orders = [pack_unit.order for pack_unit in pack.units if pack_unit.is_active]
    assert len(set(orders)) == len(orders), f"дубли order: {orders}"
