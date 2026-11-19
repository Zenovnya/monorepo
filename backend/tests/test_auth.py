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


class _ResetSession:
    """Минимальная заглушка AsyncSession для проверки сброса пароля."""

    def __init__(self, user, token_record=None, refresh_tokens=None):
        self.user = user
        self.token_record = token_record
        self.refresh_tokens = list(refresh_tokens or [])
        self.added = []
        self.deleted = []
        self.committed = False

    async def scalar(self, _query):
        return self.token_record

    async def scalars(self, _query):
        class _Result:
            def __init__(self, items):
                self._items = items

            def all(self):
                return self._items

        return _Result(self.refresh_tokens)

    async def get(self, _model, _pk):
        return self.user

    def add(self, obj):
        self.added.append(obj)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        self.committed = True

    async def refresh(self, _obj):
        return None


def _make_user():
    from app.modules.auth.models import User

    return User(
        id=uuid.uuid4(),
        email="reset@example.com",
        hashed_password=service.hash_password("old-password-123"),
        name="Анна",
    )


def _make_reset_record(user_id, *, used=False, expired=False):
    from datetime import datetime, timedelta, timezone

    from app.modules.auth.models import PasswordResetToken

    ttl = -5 if expired else 30
    return PasswordResetToken(
        user_id=user_id,
        token_hash="irrelevant",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl),
        used_at=datetime.now(timezone.utc) if used else None,
    )


def test_reset_token_hash_is_stable_and_not_plaintext() -> None:
    """В БД попадает sha256, а не сам токен."""
    raw = "super-secret-reset-token"
    hashed = service.hash_reset_token(raw)

    assert hashed != raw
    assert len(hashed) == 64
    assert service.hash_reset_token(raw) == hashed


@pytest.mark.asyncio
async def test_reset_password_changes_hash_and_revokes_sessions() -> None:
    """Сброс пароля меняет пароль и выкидывает все сессии."""
    from app.modules.auth.models import RefreshToken

    user = _make_user()
    old_hash = user.hashed_password
    record = _make_reset_record(user.id)
    sessions = [
        RefreshToken(user_id=user.id, token="a" * 64, expires_at=None),
        RefreshToken(user_id=user.id, token="b" * 64, expires_at=None),
    ]
    session = _ResetSession(user, record, sessions)

    await service.reset_password(session, "raw-token", "new-password-456")

    assert user.hashed_password != old_hash
    assert service.verify_password("new-password-456", user.hashed_password)
    assert record.used_at is not None
    # Обе сессии отозваны: угнанный аккаунт не должен пережить сброс.
    assert len(session.deleted) == 2
    assert session.committed is True


@pytest.mark.asyncio
async def test_reset_password_rejects_used_token() -> None:
    user = _make_user()
    record = _make_reset_record(user.id, used=True)
    session = _ResetSession(user, record)

    with pytest.raises(service.InvalidResetTokenError):
        await service.reset_password(session, "raw-token", "new-password-456")

    assert session.committed is False


@pytest.mark.asyncio
async def test_reset_password_rejects_expired_token() -> None:
    user = _make_user()
    record = _make_reset_record(user.id, expired=True)
    session = _ResetSession(user, record)

    with pytest.raises(service.InvalidResetTokenError):
        await service.reset_password(session, "raw-token", "new-password-456")


@pytest.mark.asyncio
async def test_reset_password_rejects_unknown_token() -> None:
    user = _make_user()
    session = _ResetSession(user, token_record=None)

    with pytest.raises(service.InvalidResetTokenError):
        await service.reset_password(session, "unknown", "new-password-456")


@pytest.mark.asyncio
async def test_reset_password_rejects_short_password() -> None:
    user = _make_user()
    session = _ResetSession(user, _make_reset_record(user.id))

    with pytest.raises(service.WeakPasswordError):
        await service.reset_password(session, "raw-token", "short")


def test_password_reset_email_contains_link_and_escapes_nothing() -> None:
    """Письмо содержит ссылку и срок действия."""
    from app.email_service import build_password_reset_email

    message = build_password_reset_email(
        name="Анна",
        link="https://app/reset?token=abc",
        ttl_minutes=30,
    )

    assert "https://app/reset?token=abc" in message["text"]
    assert "30" in message["text"]
    assert "https://app/reset?token=abc" in message["html"]
    assert "Анна" in message["text"]


def test_email_not_configured_without_key() -> None:
    """Без RESEND_API_KEY сервис честно сообщает о ненастроенности."""
    from app import email_service

    settings = get_settings()
    original = settings.resend_api_key
    try:
        settings.resend_api_key = ""
        assert email_service.is_email_configured() is False
        settings.resend_api_key = "re_test_key"
        assert email_service.is_email_configured() is True
    finally:
        settings.resend_api_key = original


def test_as_aware_utc_handles_naive_and_aware() -> None:
    """Naive datetime из SQLite не должен ломать сравнение сроков.

    На Postgres TIMESTAMPTZ приходит с таймзоной, но драйверы/SQLite отдают
    naive, и ``expires_at <= now`` падал с TypeError (500 вместо 400).
    """
    from datetime import datetime, timedelta, timezone

    naive = datetime(2026, 1, 1, 12, 0)
    aware = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)

    assert service._as_aware_utc(naive) == aware
    assert service._as_aware_utc(aware) == aware
    # Сравнение больше не падает.
    assert service._as_aware_utc(naive) <= datetime.now(timezone.utc) + timedelta(days=1)
