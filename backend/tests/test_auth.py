"""Юнит-тесты сервиса аутентификации.

Тесты не требуют базы данных: проверяют чистые функции
хэширования паролей и работу с JWT-токенами.
"""

import uuid

import pytest
from jose import jwt

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