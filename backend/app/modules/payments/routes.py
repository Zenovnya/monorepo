"""Роуты модуля платежей."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.modules.auth import service as auth_service
from app.modules.payments import service
from app.modules.payments.schemas import (
    PaymentCreateOut,
    PremiumStatusRead,
    SubscriptionCreateIn,
    SubscriptionRead,
)

router = APIRouter(prefix="/payments", tags=["payments"])


def _get_current_user_id(
    authorization: str,
) -> uuid.UUID:
    """Декодирует access-токен и возвращает идентификатор пользователя."""
    try:
        return auth_service.decode_access_token(authorization)
    except auth_service.AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


def _to_http_error(exc: service.PaymentsError) -> HTTPException:
    if isinstance(exc, service.PlanNotFoundError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, service.SubscriptionNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


@router.get("/subscriptions", response_model=list[SubscriptionRead])
async def list_subscriptions(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Возвращает подписки пользователя."""
    user_id = _get_current_user_id(authorization)
    sub = await service.get_subscription(session, user_id)
    return [sub] if sub else []


@router.get("/premium-status", response_model=PremiumStatusRead)
async def premium_status(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Возвращает статус премиум-доступа."""
    user_id = _get_current_user_id(authorization)
    is_premium = await service.is_premium(session, user_id)
    sub = await service.get_subscription(session, user_id)
    return {
        "is_premium": is_premium,
        "subscription": sub,
    }


@router.post("/create-payment", response_model=PaymentCreateOut)
async def create_payment(
    data: SubscriptionCreateIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Создаёт платёж в ЮKassa."""
    user_id = _get_current_user_id(authorization)
    try:
        return await service.create_payment(session, user_id, data.plan)
    except service.PaymentsError as exc:
        raise _to_http_error(exc) from exc


@router.post("/webhook")
async def yookassa_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Обрабатывает webhook от ЮKassa (подтверждение оплаты)."""
    body = await request.body()
    signature = request.headers.get("Idempotence-Key", "")

    # Безопасность: в production секрет webhook обязателен, иначе любой
    # может отправить payment.succeeded и получить премиум/гемы бесплатно.
    # В debug (локальная разработка) проверку подписи пропускаем.
    # TODO: заменить HMAC на официальную верификацию ЮKassa
    #       (проверка IP-адресов + запрос статуса платежа через API).
    secret = service.settings.yookassa_webhook_secret
    if not secret:
        if not service.settings.debug:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Платёжный webhook не настроен",
            )
    elif not service._verify_signature(body, signature):
        raise HTTPException(status_code=400, detail="Неверная подпись")

    try:
        payload = json.loads(body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Некорректный JSON") from exc

    payment_id = payload.get("object", {}).get("id", "")
    event = payload.get("event", "")
    paid = event == "payment.succeeded"

    try:
        await service.confirm_payment(session, payment_id, paid=paid)
    except service.PaymentsError as exc:
        raise _to_http_error(exc) from exc

    return {"ok": True}