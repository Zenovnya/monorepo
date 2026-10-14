"""Модуль маскота: фразы, состояние пользователя и API."""

from app.modules.mascot.models import MascotPhrase, UserMascotState, UserShownPhrase
from app.modules.mascot.routes import router

__all__ = ["MascotPhrase", "UserMascotState", "UserShownPhrase", "router"]