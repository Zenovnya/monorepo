"""Юнит-тесты сервиса аутентификации.

Тесты не требуют базы данных: проверяют чистые функции
хэширования паролей и работу с JWT-токенами.
"""

import uuid

import pytest
import jwt

from app.config import get_settings
from app.modules.auth import service


def test_hash_and_verify_password() -> None:
    """Хэш пароля проверяется корректно, а неверный пароль отклоняется."""
    password = "correct-horse-battery-staple"

    hashed = service.hash_password(password)

    assert hashed != password
    assert service.verify_password(password, hashed) is True
    assert service.verify_password("wrong-password", hashed) is False


def test_decode_access_token_roundtrip() -> None:
    """Декодированный access-токен возвращает исходный user_id."""
    user_id = uuid.uuid4()

    # Создаём токен напрямую через приватную функцию сервиса.
    token = service._create_access_token(user_id)
    decoded = service.decode_access_token(token)

    assert decoded == user_id


def test_decode_access_token_rejects_wrong_type() -> None:
    """Access-токен с типом refresh отклоняется сервисом."""
    settings = get_settings()

    wrong_type_token = jwt.encode(
        {"sub": str(uuid.uuid4()), "type": "refresh"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(service.InvalidCredentialsError):
        service.decode_access_token(wrong_type_token)

class _StubSession:
    """Минимальная заглушка AsyncSession для проверки register()."""

    def __init__(self) -> None:
        self.added: list[object] = []

    async def scalar(self, *_args, **_kwargs):
        return None  # почты ещё нет в базе

    def add(self, obj) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        return None

    async def refresh(self, _obj) -> None:
        return None


@pytest.mark.asyncio
async def test_register_copies_username_to_display_name() -> None:
    """Имя профиля берётся из username, а не остаётся дефолтом «Юрист».

    Раньше register() не заполнял User.name, поэтому пользователь видел
    «Юрист» в профиле и лидерборде, хотя при регистрации ввёл своё имя.
    """
    from app.modules.auth.schemas import UserRegister

    session = _StubSession()
    user = await service.register(
        session,
        UserRegister(
            email="lawyer@example.com",
            username="  Анна Петрова  ",
            password="strong-password-123",
        ),
    )

    assert user.username == "  Анна Петрова  "
    assert user.name == "Анна Петрова"


@pytest.mark.asyncio
async def test_register_without_username_uses_fallback_name() -> None:
    """Без username профиль получает понятный дефолт, а не пустую строку."""
    from app.modules.auth.schemas import UserRegister

    session = _StubSession()
    user = await service.register(
        session,
        UserRegister(email="noname@example.com", password="strong-password-123"),
    )

    assert user.name == "Юрист"
