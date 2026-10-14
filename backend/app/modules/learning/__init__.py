"""Adaptive learning MVP: competencies, versioned cases, attempts and ranking."""

from app.modules.learning import models  # noqa: F401
from app.modules.learning.routes import router

__all__ = ["models", "router"]