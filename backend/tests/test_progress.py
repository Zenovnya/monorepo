"""Юнит-тесты сервисного слоя модуля прогресса."""

import uuid
from typing import Any

import pytest

from app.modules.content.models import Case, CaseOption, Lesson
from app.modules.progress import service
from app.modules.progress.models import Progress, ReviewState


class FakeScalarResult:
    """Эмуляция результата session.scalars()."""

    def __init__(self, items: list[Any]) -> None:
        self._items = items

    def all(self) -> list[Any]:
        return self._items

    def first(self) -> Any:
        return self._items[0] if self._items else None


class FakeSession:
    """Минимальная фейковая асинхронная сессия для тестов сервиса."""

    def __init__(self) -> None:
        self._objects: dict[type, dict[Any, Any]] = {}
        self.added: list[Any] = []

    def _all_of(self, model: type) -> list[Any]:
        return list(self._objects.get(model, {}).values())

    def add_model(self, obj: Any) -> None:
        self._objects.setdefault(type(obj), {})[obj.id] = obj

    def add(self, obj: Any) -> None:
        self.added.append(obj)
        # Также помещаем в хранилище, чтобы последующие запросы его видели.
        if getattr(obj, "id", None) is not None:
            self._objects.setdefault(type(obj), {})[obj.id] = obj

    async def get(self, model: type, ident: Any) -> Any:
        return self._objects.get(model, {}).get(ident)

    async def scalars(self, statement: Any) -> FakeScalarResult:
        entity = statement.column_descriptions[0]["entity"]
        return FakeScalarResult(self._all_of(entity))

    async def scalar(self, statement: Any) -> Any:
        """Возвращает первую запись сущности (аналог session.scalar)."""
        result = await self.scalars(statement)
        return result.first()


@pytest.fixture()
def session() -> FakeSession:
    return FakeSession()


@pytest.fixture()
def lesson(session: FakeSession) -> Lesson:
    lesson = Lesson(id=uuid.uuid4(), branch_id=uuid.uuid4(), title="Права", sort_order=1)
    session.add_model(lesson)
    return lesson


@pytest.fixture()
def case(session: FakeSession, lesson: Lesson) -> Case:
    c = Case(id=uuid.uuid4(), lesson_id=lesson.id, situation="Остановка", case_type="simple")
    opt_correct = CaseOption(id=1, case_id=c.id, text="Да", is_correct=True, explanation="Правильно")
    opt_wrong = CaseOption(id=2, case_id=c.id, text="Нет", is_correct=False)
    c.options.append(opt_correct)
    c.options.append(opt_wrong)
    session.add_model(c)
    session.add_model(opt_correct)
    session.add_model(opt_wrong)
    return c


async def test_complete_lesson_updates_progress(session: FakeSession, lesson: Lesson) -> None:
    result = await service.complete_lesson(session, uuid.uuid4(), lesson.id, 80)
    assert result["completed"] is True
    assert result["best_score"] == 80
    assert result["attempts"] == 1
    assert result["crowns"] == 2  # >=75


async def test_complete_lesson_missing_raises(session: FakeSession) -> None:
    with pytest.raises(service.LessonNotFoundError):
        await service.complete_lesson(session, uuid.uuid4(), uuid.uuid4(), 50)


async def test_answer_case_correct(session: FakeSession, case: Case) -> None:
    user_id = uuid.uuid4()
    result = await service.answer_case(session, user_id, case.id, 1)
    assert result["correct"] is True
    assert result["is_correct"] is True
    assert result["explanation"] == "Правильно"
    assert result["sm2"]["repetitions"] == 1


async def test_answer_case_wrong(session: FakeSession, case: Case) -> None:
    user_id = uuid.uuid4()
    result = await service.answer_case(session, user_id, case.id, 2)
    assert result["correct"] is False
    assert result["sm2"]["repetitions"] == 0
    assert result["sm2"]["interval_days"] == 1


async def test_answer_case_missing_case_raises(session: FakeSession) -> None:
    with pytest.raises(service.CaseNotFoundError):
        await service.answer_case(session, uuid.uuid4(), uuid.uuid4(), 1)


async def test_get_reviews_empty(session: FakeSession) -> None:
    user_id = uuid.uuid4()
    reviews = await service.get_reviews_for_user(session, user_id)
    assert reviews == []