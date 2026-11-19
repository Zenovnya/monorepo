"""Бизнес-логика модуля аутентификации.

Хеширование паролей (bcrypt) и генерация JWT-токенов (PyJWT).
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt as pyjwt
from anyio import to_thread
from fastapi import Header, HTTPException, status
from jwt import PyJWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.auth.models import PasswordResetToken, RefreshToken, User
from app.modules.auth.schemas import UserRegister

settings = get_settings()


class AuthError(Exception):
    """Базовое исключение модуля аутентификации."""


class InvalidResetTokenError(AuthError):
    """Токен сброса пароля недействителен, истёк или уже использован."""


class WeakPasswordError(AuthError):
    """Пароль не соответствует требованиям."""


class InvalidCredentialsError(AuthError):
    """Неверные учётные данные."""


class EmailAlreadyRegisteredError(AuthError):
    """Пользователь с таким email уже существует."""


class InvalidRefreshTokenError(AuthError):
    """Недействительный или просроченный refresh-токен."""


class UserNotFoundError(AuthError):
    """Пользователь не найден."""


def hash_refresh_token(refresh_value: str) -> str:
    """Хеширует refresh-токен перед сохранением в БД (SHA-256).

    Значение — JWT с 256-битной энтропией, подбирать его бессмысленно, поэтому
    достаточно быстрого детерминированного хеша (bcrypt здесь избыточен и
    сломал бы поиск по индексу). Зато дамп БД больше не содержит рабочих
    refresh-токенов: по хешу исходную строку не восстановить.
    """
    return hashlib.sha256(refresh_value.encode("utf-8")).hexdigest()


def _password_bytes(password: str) -> bytes:
    """Кодирует пароль в UTF-8 и обрезает до 72 байт.

    bcrypt использует только первые 72 байта пароля, а новые версии библиотеки
    выбрасывают ошибку на более длинных значениях. Обрезаем сами — так длинный
    пароль (до 128 символов по схеме, что в UTF-8 может превышать 72 байта) не
    приводит к 500, а поведение hash/verify остаётся согласованным.
    """
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    """Хеширует пароль с помощью bcrypt (синхронно).

    ВНИМАНИЕ: bcrypt — CPU-затратная операция (~50–100 мс), которая блокирует
    поток. В async-обработчиках используйте ``hash_password_async``, чтобы не
    блокировать event loop. Эта синхронная версия оставлена для тестов и
    прямых вызовов вне запроса.
    """
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль против хеша (синхронно).

    См. примечание к ``hash_password``: в async-коде используйте
    ``verify_password_async``.
    """
    try:
        return bcrypt.checkpw(
            _password_bytes(plain_password), hashed_password.encode("utf-8")
        )
    except ValueError:
        return False


async def hash_password_async(password: str) -> str:
    """Асинхронная обёртка над ``hash_password``.

    Выполняет тяжёлое bcrypt-хеширование в отдельном потоке, чтобы не
    блокировать event loop (критично при одном uvicorn-воркере).
    """
    return await to_thread.run_sync(hash_password, password)


async def verify_password_async(
    plain_password: str, hashed_password: str
) -> bool:
    """Асинхронная обёртка над ``verify_password`` (bcrypt в отдельном потоке)."""
    return await to_thread.run_sync(
        verify_password, plain_password, hashed_password
    )


def _create_access_token(user_id: uuid.UUID) -> str:
    """Создаёт access-токен (короткоживущий JWT)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return pyjwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def _create_refresh_token_value() -> str:
    """Генерирует строковое значение refresh-токена (JWT)."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    payload = {
        "sub": str(uuid.uuid4()),
        "exp": expire,
        "type": "refresh",
    }
    return pyjwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


async def register(session: AsyncSession, data: UserRegister) -> User:
    """Регистрирует нового пользователя."""
    existing = await session.scalar(
        select(User).where(User.email == data.email)
    )
    if existing is not None:
        raise EmailAlreadyRegisteredError("Пользователь с таким email уже существует")

    display_name = (data.username or "").strip()[:40]
    user = User(
        email=data.email,
        username=data.username,
        hashed_password=await hash_password_async(data.password),
        # Имя профиля по умолчанию — то, что ввёл пользователь при регистрации.
        # Иначе `name` остаётся дефолтом модели («Юрист»), и в интерфейсе
        # пользователь видит не своё имя, а заглушку.
        name=display_name or "Юрист",
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def authenticate(
    session: AsyncSession, email: str, password: str
) -> User:
    """Проверяет учётные данные и возвращает пользователя."""
    user = await session.scalar(select(User).where(User.email == email))
    if user is None or not await verify_password_async(
        password, user.hashed_password
    ):
        raise InvalidCredentialsError("Неверный email или пароль")
    if not user.is_active:
        raise AuthError("Пользователь деактивирован")
    return user


async def create_refresh_token(session: AsyncSession, user: User) -> str:
    """Создаёт и сохраняет refresh-токен для пользователя."""
    refresh_value = _create_refresh_token_value()
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    token = RefreshToken(
        user_id=user.id,
        token=hash_refresh_token(refresh_value),
        expires_at=expires_at,
    )
    session.add(token)
    await session.commit()
    return refresh_value


async def issue_tokens(session: AsyncSession, user: User) -> dict:
    """Выдаёт пару токенов (access + сохранённый refresh)."""
    access_token = _create_access_token(user.id)
    refresh_value = await create_refresh_token(session, user)
    return {
        "access_token": access_token,
        "refresh_token": refresh_value,
        "token_type": "bearer",
    }


async def rotate_refresh_token(
    session: AsyncSession, refresh_value: str
) -> dict:
    """Обновляет пару токенов по действующему refresh-токену."""
    record = await session.scalar(
        select(RefreshToken).where(
            RefreshToken.token == hash_refresh_token(refresh_value)
        )
    )
    if record is None or record.is_expired:
        raise InvalidRefreshTokenError("Недействительный refresh-токен")

    user = await session.get(User, record.user_id)
    if user is None or not user.is_active:
        raise InvalidRefreshTokenError("Пользователь не найден или деактивирован")

    # Инвалидируем старый refresh-токен.
    await session.delete(record)
    await session.flush()

    access_token = _create_access_token(user.id)
    new_refresh = await create_refresh_token(session, user)
    return {
        "access_token": access_token,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


async def revoke_refresh_token(
    session: AsyncSession,
    refresh_value: str,
    user_id: uuid.UUID | None = None,
) -> None:
    """Отзывает refresh-токен (выход из системы).

    Если передан ``user_id``, отзывается только собственный токен — так logout
    не может погасить чужую сессию по украденному значению.
    """
    record = await session.scalar(
        select(RefreshToken).where(
            RefreshToken.token == hash_refresh_token(refresh_value)
        )
    )
    if record is not None and user_id is not None and record.user_id != user_id:
        return
    if record is not None:
        await session.delete(record)
        await session.commit()


def decode_access_token(token: str) -> uuid.UUID:
    """Декодирует access-токен и возвращает идентификатор пользователя."""
    try:
        payload = pyjwt.decode(
            token,
            settings.jwt_secret_key,
            # algorithms обязателен: без него PyJWT доверяет заголовку alg
            # и позволяет подменить алгоритм на "none".
            algorithms=[settings.jwt_algorithm],
        )
    except PyJWTError as exc:
        raise InvalidCredentialsError("Недействительный access-токен") from exc

    if payload.get("type") != "access":
        raise InvalidCredentialsError("Неверный тип токена")

    sub = payload.get("sub")
    if sub is None:
        raise InvalidCredentialsError("Токен не содержит идентификатора пользователя")
    try:
        return uuid.UUID(str(sub))
    except (ValueError, AttributeError, TypeError) as exc:
        raise InvalidCredentialsError(
            "Токен содержит некорректный идентификатор пользователя"
        ) from exc


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User:
    """Возвращает пользователя по идентификатору."""
    user = await session.get(User, user_id)
    if user is None:
        raise UserNotFoundError("Пользователь не найден")
    return user


def get_bearer_token(
    authorization: str | None = Header(default=None),
) -> str:
    """FastAPI-зависимость: извлекает токен из заголовка Authorization."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Отсутствует Bearer-токен",
        )
    return authorization.split(" ", 1)[1].strip()


def _as_aware_utc(value: datetime) -> datetime:
    """Приводит дату из БД к aware-UTC.

    Postgres (TIMESTAMPTZ) возвращает aware datetime, но некоторые драйверы и
    SQLite отдают naive — сравнение с aware ``datetime.now(timezone.utc)``
    падает с TypeError. Правим здесь, а не в каждом месте вызова.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def hash_reset_token(value: str) -> str:
    """sha256-хеш значения токена сброса (в БД хранится только он)."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def create_password_reset_token(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> str | None:
    """Создаёт одноразовый токен сброса и возвращает его значение.

    Все предыдущие неиспользованные токены пользователя удаляются: запросить
    сброс дважды — нормальная ситуация, и старая ссылка не должна оставаться
    рабочей.
    """
    previous = await session.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
    )
    for stale in previous.all():
        await session.delete(stale)

    raw = secrets.token_urlsafe(32)
    session.add(
        PasswordResetToken(
            user_id=user_id,
            token_hash=hash_reset_token(raw),
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=settings.password_reset_ttl_minutes),
        )
    )
    await session.flush()
    return raw


async def reset_password(
    session: AsyncSession,
    raw_token: str,
    new_password: str,
) -> User:
    """Меняет пароль по одноразовому токену.

    После успешной смены токен помечается использованным, а ВСЕ refresh-токены
    пользователя отзываются: если аккаунт увели, сброс пароля должен выкинуть
    злоумышленника из всех сессий.
    """
    if len(new_password or "") < 8:
        raise WeakPasswordError("Пароль должен быть не короче 8 символов")

    record = await session.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_reset_token(raw_token)
        )
    )
    now = datetime.now(timezone.utc)
    if record is None or record.used_at is not None:
        raise InvalidResetTokenError("Ссылка недействительна или уже использована")
    if _as_aware_utc(record.expires_at) <= now:
        raise InvalidResetTokenError("Срок действия ссылки истёк")

    user = await session.get(User, record.user_id)
    if user is None:
        raise InvalidResetTokenError("Ссылка недействительна")

    user.hashed_password = await hash_password_async(new_password)
    record.used_at = now

    # Отзываем все сессии пользователя.
    active = await session.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user.id)
    )
    for token in active.all():
        await session.delete(token)

    await session.commit()
    await session.refresh(user)
    return user
