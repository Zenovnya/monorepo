"""Pydantic-схемы модуля платежей."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SubscriptionCreateIn(BaseModel):
    """Запрос на создание платежа (подписка или пакет гемов)."""

    plan: str = Field(
        default="monthly",
        pattern="^(monthly|yearly|gems_500|gems_1200|gems_3000)$",
    )