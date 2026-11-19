"""Роуты модуля аутентификации."""

import logging
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service
from app.modules.auth.rate_limit import (
    auth_forgot_rate_limit,
    auth_login_rate_limit,
    auth_register_rate_limit,
    auth_reset_rate_limit,
)
from app.modules.auth.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenPair,
    UserLogin,
    UserRead,
    UserRegister,
)

from sqlalchemy import select

from app.config import get_settings
from app.email_service import (
    EmailNotConfiguredError,
    build_password_reset_email,
    send_email,
)
from app.modules.auth.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_http_error(exc: service.AuthError) -> HTTPException:
    """Преобразует исключения сервиса в HTTP-ошибки."""
    if isinstance(exc, service.EmailAlreadyRegisteredError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    if isinstance(
        exc,
        (service.InvalidCredentialsError, service.InvalidRefreshTokenError),
    ):
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )
    if isinstance(exc, service.UserNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(exc),
    )


@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
    dependencies=[auth_register_rate_limit],
)
async def register(
    data: UserRegister,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Регистрация нового пользователя и выдача токенов."""
    try:
        user = await service.register(session, data)
    except service.AuthError as exc:
        raise _to_http_error(exc) from exc
    return await service.issue_tokens(session, user)


@router.post(
    "/login",
    response_model=TokenPair,
    dependencies=[auth_login_rate_limit],
)
async def login(
    data: UserLogin,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Вход пользователя и выдача токенов."""
    try:
        user = await service.authenticate(session, data.email, data.password)
    except service.AuthError as exc:
        raise _to_http_error(exc) from exc
    return await service.issue_tokens(session, user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    data: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Обновление пары токенов по refresh-токену."""
    try:
        return await service.rotate_refresh_token(session, data.refresh_token)
    except service.AuthError as exc:
        raise _to_http_error(exc) from exc


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    data: LogoutRequest,
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Выход пользователя: отзыв refresh-токена.

    Если клиент прислал access-токен, отзываем только его собственный
    refresh — чужую сессию погасить нельзя.
    """
    owner_id = None
    if authorization and authorization.lower().startswith("bearer "):
        try:
            owner_id = service.decode_access_token(
                authorization.split(" ", 1)[1].strip()
            )
        except service.AuthError:
            owner_id = None
    await service.revoke_refresh_token(session, data.refresh_token, owner_id)


@router.get("/me", response_model=UserRead)
async def get_current_user(
    authorization: str = Depends(service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> service.User:
    """Возвращает данные текущего пользователя."""
    try:
        user_id = service.decode_access_token(authorization)
    except service.AuthError as exc:
        raise _to_http_error(exc) from exc
    try:
        return await service.get_user_by_id(session, user_id)
    except service.AuthError as exc:
        raise _to_http_error(exc) from exc


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    dependencies=[auth_forgot_rate_limit],
)
async def forgot_password(
    data: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Отправляет письмо со ссылкой сброса пароля.

    Ответ одинаковый независимо от того, зарегистрирован email или нет:
    иначе эндпоинт превращается в проверялку существующих аккаунтов.
    Ошибки отправки письма тоже не пробрасываются наружу — они логируются.
    """
    settings = get_settings()
    user = await session.scalar(select(User).where(User.email == data.email))

    if user is not None and user.is_active:
        raw_token = await service.create_password_reset_token(session, user.id)
        await session.commit()

        link = (
            f"{settings.app_base_url.rstrip('/')}/reset-password"
            f"?token={quote(raw_token)}"
        )
        message = build_password_reset_email(
            name=user.name,
            link=link,
            ttl_minutes=settings.password_reset_ttl_minutes,
        )
        try:
            await send_email(
                to=user.email,
                subject=message["subject"],
                html=message["html"],
                text=message["text"],
            )
        except EmailNotConfiguredError:
            # Почта не настроена: токен создан, но письма нет. Сообщаем только
            # в лог, чтобы не раскрывать состояние инфраструктуры.
            logger.warning(
                "Сброс пароля запрошен, но RESEND_API_KEY не задан — письмо не отправлено"
            )
        except httpx.HTTPError:
            logger.warning("Resend недоступен, письмо со сбросом не отправлено")

    return ForgotPasswordResponse()


@router.post(
    "/reset-password",
    response_model=UserRead,
    dependencies=[auth_reset_rate_limit],
)
async def reset_password(
    data: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Устанавливает новый пароль по одноразовому токену из письма."""
    try:
        user = await service.reset_password(session, data.token, data.password)
    except service.WeakPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except service.InvalidResetTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return user
