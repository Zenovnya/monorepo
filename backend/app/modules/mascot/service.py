"""Бизнес-логика модуля маскота.

Сервисный слой отделён от роутов, что позволяет покрыть его unit-тестами
без реальной базы данных (аналогично auth/content-модулям).
"""

import random
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.mascot.models import MascotPhrase, UserMascotState, UserShownPhrase

# Известные триггеры, для которых можно запрашивать фразы.
VALID_TRIGGERS = {
    "greeting",
    "pet",
    "case_correct",
    "case_wrong",
    "app_first_open",
}


class MascotError(Exception):
    """Базовое исключение модуля маскота."""


class UnknownTriggerError(MascotError):
    """Запрошен неизвестный триггер."""


class NoPhrasesAvailableError(MascotError):
    """Для триггера нет доступных фраз."""


async def list_active_phrases(session: AsyncSession) -> list[MascotPhrase]:
    """Возвращает все активные фразы, отсортированные по sort_order."""
    result = await session.scalars(
        select(MascotPhrase)
        .where(MascotPhrase.is_active.is_(True))
        .order_by(MascotPhrase.sort_order, MascotPhrase.created_at)
    )
    return list(result.all())


async def get_phrase_for_trigger(
    session: AsyncSession,
    trigger: str,
    user_id: uuid.UUID,
) -> MascotPhrase:
    """Возвращает случайную фразу по триггеру с учётом веса и show_once.

    Фразы с ``show_once=True``, уже показанные этому пользователю
    (запись в ``UserShownPhrase``), исключаются из выборки. Показ выбранной
    фразы фиксируется в истории и обновляет ``last_phrase_id``.
    """
    if trigger not in VALID_TRIGGERS:
        raise UnknownTriggerError(f"Неизвестный триггер: {trigger}")

    result = await session.scalars(
        select(MascotPhrase)
        .where(
            MascotPhrase.trigger == trigger,
            MascotPhrase.is_active.is_(True),
        )
        .order_by(MascotPhrase.sort_order, MascotPhrase.created_at)
    )
    phrases = list(result.all())

    # Фразы с show_once, уже показанные этому пользователю, исключаем.
    shown = await session.scalars(
        select(UserShownPhrase).where(UserShownPhrase.user_id == user_id)
    )
    shown_ids = {record.phrase_id for record in shown.all()}

    available = [
        phrase
        for phrase in phrases
        if not (phrase.show_once and phrase.id in shown_ids)
    ]
    if not available:
        raise NoPhrasesAvailableError(
            f"Нет доступных фраз для триггера: {trigger}"
        )

    # Случайный выбор с учётом веса.
    weights = [max(phrase.weight, 1) for phrase in available]
    chosen = random.choices(available, weights=weights, k=1)[0]

    # Фиксируем показ в истории.
    session.add(
        UserShownPhrase(user_id=user_id, phrase_id=chosen.id)
    )

    # Обновляем последнюю показанную фразу (денормализованное поле).
    state = await _get_or_create_state(session, user_id)
    state.last_phrase_id = chosen.id

    return chosen


async def increment_pet_count(
    session: AsyncSession, user_id: uuid.UUID
) -> int:
    """Увеличивает счётчик поглаживаний на 1 и возвращает новое значение."""
    state = await _get_or_create_state(session, user_id)
    state.pet_count += 1
    return state.pet_count


async def get_pet_count(
    session: AsyncSession, user_id: uuid.UUID
) -> int:
    """Возвращает счётчик поглаживаний; для нового пользователя — 0."""
    state = await _get_or_create_state(session, user_id)
    return state.pet_count


async def _get_or_create_state(
    session: AsyncSession, user_id: uuid.UUID
) -> UserMascotState:
    """Возвращает состояние маскота, создавая его при первом обращении."""
    state = await session.scalar(
        select(UserMascotState).where(UserMascotState.user_id == user_id)
    )
    if state is None:
        state = UserMascotState(user_id=user_id, pet_count=0)
        session.add(state)
    return state