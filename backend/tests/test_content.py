"""Юнит-тесты сервисного слоя модуля контента.

Тесты не требуют базы данных: проверяют логику выбора и формирования
ответов сервиса через фейковую асинхронную сессию.
"""

import uuid
from typing import Any

import pytest

from app.modules.content import service
from app.modules.content.models import Branch, Case, CaseOption, Lesson


class FakeScalarResult:
    """Эмуляция результата session.scalars()."""

    def __init__(self, items: list[Any]) -> None:
        self._items = items

    def all(self) -> list[Any]:
        return self._items


class FakeSession:
    """Минимальная фейковая асинхронная сессия для тестов сервиса."""

    def __init__(self) -> None:
        self._objects: dict[type, dict[uuid.UUID, Any]] = {}

    def _all_of(self, model: type) -> list[Any]:
        return list(self._objects.get(model, {}).values())

    def add_model(self, obj: Any) -> None:
        self._objects.setdefault(type(obj), {})[obj.id] = obj

    async def get(self, model: type, ident: Any) -> Any:
        return self._objects.get(model, {}).get(ident)

    async def scalars(self, statement: Any) -> FakeScalarResult:
        # Определяем модель, по которой выполняется select, и возвращаем
        # соответствующие сохранённые объекты.
        entity = statement.column_descriptions[0]["entity"]
        return FakeScalarResult(self._all_of(entity))


@pytest.fixture()
def session() -> FakeSession:
    return FakeSession()


@pytest.fixture()
def branch(session: FakeSession) -> Branch:
    b = Branch(id=uuid.uuid4(), title="Полиция", sort_order=1)
    session.add_model(b)
    return b


@pytest.fixture()
def lesson(session: FakeSession, branch: Branch) -> Lesson:
    l = Lesson(id=uuid.uuid4(), branch_id=branch.id, title="Права и обязанности", sort_order=1)
    session.add_model(l)
    return l


@pytest.fixture()
def case(session: FakeSession, lesson: Lesson) -> Case:
    c = Case(
        id=uuid.uuid4(),
        lesson_id=lesson.id,
        situation="Вас остановил инспектор",
        case_type="lex_entrance",
        lex_entrance_type="scooter",
        lex_hint_text="Спокойно, сначала узнай причину",
        lex_hint_option_id=1,
    )
    opt = CaseOption(id=1, case_id=c.id, text="Остановиться и узнать причину", is_correct=True)
    c.options.append(opt)
    session.add_model(c)
    return c


async def test_list_branches_returns_all(session: FakeSession, branch: Branch) -> None:
    branches = await service.list_branches(session)
    assert branches == [branch]


async def test_get_branch_ok(session: FakeSession, branch: Branch) -> None:
    result = await service.get_branch_or_404(session, branch.id)
    assert result == branch


async def test_get_branch_missing_raises(session: FakeSession) -> None:
    with pytest.raises(service.BranchNotFoundError):
        await service.get_branch_or_404(session, uuid.uuid4())


async def test_get_lesson_ok(session: FakeSession, lesson: Lesson) -> None:
    result = await service.get_lesson_or_404(session, lesson.id)
    assert result == lesson


async def test_get_lesson_missing_raises(session: FakeSession) -> None:
    with pytest.raises(service.LessonNotFoundError):
        await service.get_lesson_or_404(session, uuid.uuid4())


async def test_list_cases_of_missing_lesson_raises(session: FakeSession) -> None:
    with pytest.raises(service.LessonNotFoundError):
        await service.list_cases(session, uuid.uuid4())


async def test_list_lessons_of_missing_branch_raises(session: FakeSession) -> None:
    with pytest.raises(service.BranchNotFoundError):
        await service.list_lessons(session, uuid.uuid4())