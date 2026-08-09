"""Роуты модуля аутентификации."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service
from app.modules.auth.schemas import (
    LogoutRequest,
    RefreshRequest,
    TokenPair,
    UserLogin,
    UserRead,
    UserRegister,
)

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


@router.post("/login", response_model=TokenPair)
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
    session: AsyncSession = Depends(get_session),
) -> None:
    """Выход пользователя: отзыв refresh-токена."""
    await service.revoke_refresh_token(session, data.refresh_token)


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