"""Тесты удаления аккаунта (DELETE /user/me).

Требование App Store и Google Play: если есть регистрация, удаление аккаунта
должно быть доступно в приложении. До этого эндпоинта пользователь мог только
выйти, а все данные оставались в базе навсегда.

Тесты не требуют живой БД: проверяются модель валидации, сбор владельцев по
метаданным и сценарий удаления на sqlite.
"""

import uuid

import pytest


def test_delete_account_requires_password() -> None:
    """Пароль обязателен: одного access-токена для необратимой операции мало."""
    from pydantic import ValidationError

    from app.modules.user.schemas import DeleteAccountIn

    with pytest.raises(ValidationError):
        DeleteAccountIn()
    with pytest.raises(ValidationError):
        DeleteAccountIn(password="")
    assert DeleteAccountIn(password="secret").password == "secret"


def test_user_owned_models_cover_progress_and_tokens() -> None:
    """Сбор моделей по метаданным находит таблицы с внешним ключом на users.

    Список собирается автоматически, поэтому новая таблица с ``user_id``
    попадёт в очистку сама — вручную поддерживаемый список рано или поздно
    забыли бы дополнить, и персональные данные пережили бы удаление аккаунта.
    """
    import asyncio

    from app.modules.user import service

    models = asyncio.run(service._user_owned_models())
    tables = {model.__tablename__ for model in models}

    assert "users" not in tables
    # Личные данные и сессии
    assert {"daily_xp", "refresh_tokens", "password_reset_tokens"} <= tables
    assert {"push_tokens", "notification_settings", "notification_deliveries"} <= tables
    assert {"user_achievements", "subscriptions", "payment_history"} <= tables
    # Состояние адаптивного обучения — это персональные данные и прогресс,
    # поэтому оно тоже должно попадать в очистку.
    assert {
        "adaptive_states",
        "adaptive_attempts",
        "adaptive_observations",
        "adaptive_seen_families",
        "adaptive_topic_priorities",
    } <= tables


def test_delete_account_removes_rows_on_sqlite() -> None:
    """Полный сценарий на sqlite: пользователь и его данные исчезают.

    В Postgres большую часть работы делает ON DELETE CASCADE, а в sqlite
    каскад по умолчанию выключен — поэтому тест проверяет именно
    «подметание» строк, не удалённых связью.
    """
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.database import Base
    from app.modules.auth.models import User
    from app.modules.progress.models import DailyXp
    from app.modules.user import service

    async def _run() -> None:
        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        factory = async_sessionmaker(bind=engine, expire_on_commit=False)
        user_id = uuid.uuid4()
        async with factory() as session:
            session.add(
                User(
                    id=user_id,
                    email="delete-me@example.com",
                    hashed_password="x",
                )
            )
            await session.flush()
            session.add(
                DailyXp(user_id=user_id, day=__import__("datetime").date(2026, 1, 1), xp=10)
            )
            await session.commit()

            user = await session.get(User, user_id)
            result = await service.delete_account(session, user)
            assert result["deleted"] is True
            assert result["email"] == "delete-me@example.com"

            assert await session.get(User, user_id) is None
            from sqlalchemy import func, select

            remaining = await session.scalar(
                select(func.count()).select_from(DailyXp).where(DailyXp.user_id == user_id)
            )
            assert remaining == 0

        await engine.dispose()

    asyncio.run(_run())
