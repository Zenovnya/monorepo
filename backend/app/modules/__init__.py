"""Агрегация роутеров всех модулей приложения."""

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.content.routes import router as content_router
from app.modules.gamification.routes import router as gamification_router
from app.modules.mascot.routes import router as mascot_router
from app.modules.notifications.routes import router as notifications_router
from app.modules.payments.routes import router as payments_router
from app.modules.progress.routes import router as progress_router
from app.modules.srs.routes import router as srs_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(content_router)
api_router.include_router(mascot_router)
api_router.include_router(progress_router)
api_router.include_router(srs_router)
api_router.include_router(gamification_router)
api_router.include_router(payments_router)
api_router.include_router(notifications_router)