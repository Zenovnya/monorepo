"""Агрегация роутеров всех модулей приложения."""

from fastapi import APIRouter

from app.modules.admin.routes import router as admin_router
from app.modules.admin.ui import router as admin_ui_router
from app.modules.analytics.routes import router as analytics_router
from app.modules.auth.router import router as auth_router
from app.modules.content.lexbear_routes import router as lexbear_router
from app.modules.content.routes import router as content_router
from app.modules.gamification.routes import router as gamification_router
from app.modules.mascot.routes import router as mascot_router
from app.modules.notifications.routes import router as notifications_router
from app.modules.payments.routes import router as payments_router
from app.modules.progress.routes import router as progress_router
from app.modules.srs.routes import router as srs_router
from app.modules.user.routes import router as user_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(content_router)
api_router.include_router(lexbear_router)
api_router.include_router(mascot_router)
api_router.include_router(progress_router)
api_router.include_router(srs_router)
api_router.include_router(gamification_router)
api_router.include_router(payments_router)
api_router.include_router(notifications_router)
api_router.include_router(analytics_router)
api_router.include_router(user_router)
api_router.include_router(admin_router)
api_router.include_router(admin_ui_router)