"""Юнит-тесты сервисного слоя модуля маскота.

Тесты не требуют базы данных: проверяют логику выбора фраз и работы
со счётчиком поглаживаний через фейковую асинхронную сессию.
"""

import uuid
from typing import Any

import pytest
from sqlalchemy import BinaryExpression, select
from sqlalchemy.sql.elements import ColumnElement

from app.modules.mascot import service
from app.modules.mascot.models import MascotPhrase, UserMascotState, UserShownPhrase


class FakeScalarResult:
    """Эмуляция результата session.scalars()."""

    def __init__(self, items: list[Any]) -> None:
        self._items = items

    def all(self) -> list[Any]:
        return self._items


def _matches(obj: Any, criteria: list) -> bool:
    """Проверяет объект против простых where-условий (равенство и is_)."""
    for crit in criteria:
        if not isinstance(crit, BinaryExpression):
            continue
        left: ColumnElement = crit.left
        if not hasattr(left, "key"):
            continue
        attr = getattr(obj, left.key, None)
        right = crit.right
        # Извлекаем ожидаемое значение из правой части.
        if isinstance(right, bool):
            expected = right
        elif hasattr(right, "value"):
            expected = right.value
        else:
            expected = right
        if attr != expected:
            return False
    return True


class FakeSession:
    """Минимальная фейковая асинхронная сессия для тестов сервиса."""

    def __init__(self) -> None:
        self._objects: dict[type, list[Any]] = {}
        self.added: list[Any] = []

    def _all_of(self, model: type) -> list[Any]:
        return list(self._objects.get(model, []))

    def add_model(self, obj: Any) -> None:
        self._objects.setdefault(type(obj), []).append(obj)

    async def scalars(self, statement: Any) -> FakeScalarResult:
        entity = statement.column_descriptions[0]["entity"]
        criteria = list(getattr(statement, "_where_criteria", []))
        items = [
            obj
            for obj in self._all_of(entity)
            if _matches(obj, criteria)
        ]
        return FakeScalarResult(items)

    async def scalar(self, statement: Any) -> Any:
        result = await self.scalars(statement)
        return result.all()[0] if result.all() else None

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    def flush(self) -> None:
        pass


@pytest.fixture()
def session() -> FakeSession:
    return FakeSession()


def _make_phrase(
    *,
    trigger: str,
    phrase: str,
    emotion: str = "happy",
    weight: int = 1,
    show_once: bool = False,
    is_active: bool = True,
    sort_order: int = 0,
) -> MascotPhrase:
    return MascotPhrase(
        id=uuid.uuid4(),
        trigger=trigger,
        phrase=phrase,
        emotion=emotion,
        weight=weight,
        show_once=show_once,
        is_active=is_active,
        sort_order=sort_order,
    )


async def test_list_active_phrases_excludes_inactive(
    session: FakeSession,
) -> None:
    session.add_model(_make_phrase(trigger="greeting", phrase="Привет!"))
    session.add_model(
        _make_phrase(trigger="greeting", phrase="Скрытая", is_active=False)
    )

    phrases = await service.list_active_phrases(session)

    assert len(phrases) == 1
    assert phrases[0].phrase == "Привет!"


async def test_phrase_choice_respects_weight(
    session: FakeSession,
) -> None:
    """Выбор фразы учитывает weight: фраза с большим весом выбирается чаще."""
    heavy = _make_phrase(
        trigger="greeting", phrase="Тяжёлая", weight=10
    )
    light = _make_phrase(
        trigger="greeting", phrase="Лёгкая", weight=1
    )
    session.add_model(heavy)
    session.add_model(light)

    heavy_count = 0
    light_count = 0
    for _ in range(200):
        chosen = await service.get_phrase_for_trigger(
            session, "greeting", uuid.uuid4()
        )
        if chosen.id == heavy.id:
            heavy_count += 1
        elif chosen.id == light.id:
            light_count += 1

    # Обе фразы доступны, но тяжёлая выбирается чаще.
    assert heavy_count > 0
    assert light_count > 0
    assert heavy_count > light_count


async def test_show_once_phrase_not_repeated_for_same_user(
    session: FakeSession,
) -> None:
    user_id = uuid.uuid4()
    phrase = _make_phrase(trigger="greeting", phrase="Одноразовая", show_once=True)
    session.add_model(phrase)

    first = await service.get_phrase_for_trigger(session, "greeting", user_id)
    assert first.id == phrase.id

    # Имитируем, что показ уже зафиксирован.
    session.add_model(UserShownPhrase(user_id=user_id, phrase_id=phrase.id))

    with pytest.raises(service.NoPhrasesAvailableError):
        await service.get_phrase_for_trigger(session, "greeting", user_id)


async def test_show_once_phrase_available_for_other_user(
    session: FakeSession,
) -> None:
    first_user = uuid.uuid4()
    second_user = uuid.uuid4()
    phrase = _make_phrase(trigger="greeting", phrase="Одноразовая", show_once=True)
    session.add_model(phrase)

    # Первый пользователь уже видел фразу.
    session.add_model(
        UserShownPhrase(user_id=first_user, phrase_id=phrase.id)
    )

    chosen = await service.get_phrase_for_trigger(session, "greeting", second_user)
    assert chosen.id == phrase.id


async def test_inactive_phrases_never_enter_selection(
    session: FakeSession,
) -> None:
    user_id = uuid.uuid4()
    inactive = _make_phrase(
        trigger="greeting", phrase="Неактивная", is_active=False
    )
    active = _make_phrase(trigger="greeting", phrase="Активная")
    session.add_model(inactive)
    session.add_model(active)

    chosen = await service.get_phrase_for_trigger(session, "greeting", user_id)
    assert chosen.id == active.id


async def test_unknown_trigger_raises(session: FakeSession) -> None:
    with pytest.raises(service.UnknownTriggerError):
        await service.get_phrase_for_trigger(session, "nope", uuid.uuid4())


async def test_all_show_once_phrases_shown_raises(
    session: FakeSession,
) -> None:
    user_id = uuid.uuid4()
    p1 = _make_phrase(trigger="greeting", phrase="Ф1", show_once=True)
    p2 = _make_phrase(trigger="greeting", phrase="Ф2", show_once=True)
    session.add_model(p1)
    session.add_model(p2)
    session.add_model(UserShownPhrase(user_id=user_id, phrase_id=p1.id))
    session.add_model(UserShownPhrase(user_id=user_id, phrase_id=p2.id))

    with pytest.raises(service.NoPhrasesAvailableError):
        await service.get_phrase_for_trigger(session, "greeting", user_id)


async def test_pet_increments_count(session: FakeSession) -> None:
    user_id = uuid.uuid4()
    session.add_model(UserMascotState(user_id=user_id, pet_count=10))

    new_count = await service.increment_pet_count(session, user_id)

    assert new_count == 11
    state = await session.scalar(
        select(UserMascotState).where(UserMascotState.user_id == user_id)
    )
    assert state.pet_count == 11


async def test_pet_increments_from_zero_for_new_user(
    session: FakeSession,
) -> None:
    user_id = uuid.uuid4()

    new_count = await service.increment_pet_count(session, user_id)

    assert new_count == 1


async def test_pet_count_returns_zero_for_new_user(
    session: FakeSession,
) -> None:
    user_id = uuid.uuid4()

    count = await service.get_pet_count(session, user_id)

    assert count == 0