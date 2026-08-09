"""Бизнес-логика модуля аутентификации.

Хеширование паролей (bcrypt) и генерация JWT-токенов (python-jose).
"""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.auth.models import RefreshToken, User
from app.modules.auth.schemas import UserRegister

settings = get_settings()


class AuthError(Exception):
    """Базовое исключение модуля аутентификации."""


class InvalidCredentialsError(AuthError):
    """Неверные учётные данные."""


class EmailAlreadyRegisteredError(AuthError):
    """Пользователь с таким email уже существует."""


class InvalidRefreshTokenError(AuthError):
    """Недействительный или просроченный refresh-токен."""


class UserNotFoundError(AuthError):
    """Пользователь не найден."""


def hash_password(password: str) -> str:
    """Хеширует пароль с помощью bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль против хеша."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except ValueError:
        return False


def _create_access_token(user_id: uuid.UUID) -> str:
    """Создаёт access-токен (короткоживущий JWT)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(
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
    return jwt.encode(
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

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
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
    if user is None or not verify_password(password, user.hashed_password):
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
        token=refresh_value,
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
        select(RefreshToken).where(RefreshToken.token == refresh_value)
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
    session: AsyncSession, refresh_value: str
) -> None:
    """Отзывает refresh-токен (выход из системы)."""
    record = await session.scalar(
        select(RefreshToken).where(RefreshToken.token == refresh_value)
    )
    if record is not None:
        await session.delete(record)
        await session.commit()


def decode_access_token(token: str) -> uuid.UUID:
    """Декодирует access-токен и возвращает идентификатор пользователя."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise InvalidCredentialsError("Недействительный access-токен") from exc

    if payload.get("type") != "access":
        raise InvalidCredentialsError("Неверный тип токена")

    sub = payload.get("sub")
    if sub is None:
        raise InvalidCredentialsError("Токен не содержит идентификатора пользователя")
    return uuid.UUID(sub)


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