"""Бизнес-логика пользовательского профиля и мишки Lex."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User


class UserError(Exception):
    """Базовое исключение модуля пользователя."""


async def onboard_user(
    session: AsyncSession,
    user: User,
    *,
    goal: str | None = None,
    minutes: int | None = None,
    codex: str | None = None,
    name: str | None = None,
) -> dict:
    """Завершает онбординг: сохраняет имя, цель и отмечает пройденным."""
    if name and name.strip():
        user.name = name.strip()[:40]
    # 1 минута в день ≈ 2 XP к цели.
    if minutes and minutes > 0:
        user.daily_goal = minutes * 2
    # Кодекс/цель пока не хранятся отдельно — оставляем как подсказку.
    user.onboarded = True
    await session.commit()
    return {"ok": True, "onboarded": True, "daily_goal": user.daily_goal}


async def pet_bear(
    session: AsyncSession,
    user: User,
    pet_count: int,
) -> dict:
    """Погладить мишку: повышает настроение на 5 (до 100)."""
    user.bear_mood = min(100, user.bear_mood + 5)
    await session.commit()
    return {"bear_mood": user.bear_mood, "pet_count": pet_count}

async def _user_owned_models() -> list:
    """Модели с колонкой ``user_id``, ссылающейся на ``users.id``.

    Собираются по метаданным, а не списком вручную: такой список пришлось бы
    поддерживать при каждой новой таблице, а забытая строка — это персональные
    данные, пережившие «удаление аккаунта».
    """
    from app.database import Base

    models = []
    for mapper in Base.registry.mappers:
        cls = mapper.class_
        table = getattr(cls, "__table__", None)
        if table is None or table.name == "users":
            continue
        if "user_id" not in table.columns:
            continue
        column = table.columns["user_id"]
        targets = {fk.target_fullname.split(".")[0] for fk in column.foreign_keys}
        if "users" in targets:
            models.append(cls)
    return models


async def delete_account(session: AsyncSession, user: User) -> dict:
    """Полностью удаляет аккаунт и все связанные данные.

    Зачем это нужно: и App Store, и Google Play требуют, чтобы приложение с
    регистрацией позволяло удалить аккаунт прямо в нём, а не «напишите нам на
    почту». До этого эндпоинта пользователь мог только выйти — данные
    (переписка с прогрессом, e-mail, платёжная история) оставались навсегда.

    Как удаляем:

    0. Отключаем автосписания и отменяем незавершённые платежи
       (``payments.stop_autopayments``). Это делается до удаления, потому что
       способ оплаты хранится в подписке.
    1. Удаляем строку пользователя. У 20 таблиц внешний ключ объявлен с
       ``ON DELETE CASCADE``, поэтому Postgres чистит прогресс, токены,
       подписки, достижения, уведомления одним запросом.
    2. Затем подметаем оставшиеся строки с этим ``user_id``. В Postgres их
       быть не должно — это защита от таблицы, добавленной позже без каскада,
       и от sqlite, где каскад по умолчанию выключен (тесты).
    """
    from sqlalchemy import delete

    user_id = user.id
    email = user.email

    # Автоплатёж отключаем ДО удаления строк: подписка — единственное место,
    # где хранится сохранённый способ оплаты. Если удалить пользователя
    # первым, каскад унесёт подписку и магазин навсегда потеряет связь со
    # способом, по которому продолжают списываться деньги.
    from app.modules.payments import service as payments_service

    from app.modules.payments import service as _payments

    had_subscription = await _payments.get_subscription(session, user_id) is not None
    payments = await payments_service.stop_autopayments(session, user_id)

    await session.delete(user)
    await session.flush()

    leftover = 0
    for model in await _user_owned_models():
        result = await session.execute(delete(model).where(model.user_id == user_id))
        leftover += result.rowcount or 0

    await session.commit()
    return {
        "deleted": True,
        "email": email,
        "leftover_rows": leftover,
        "had_subscription": had_subscription,
        "autopayment_stopped": payments["stopped"],
        "canceled_payments": payments["canceled_payments"],
    }
