"""Pydantic-схемы модуля геймификации."""

from pydantic import BaseModel, Field


class AchievementRead(BaseModel):
    """Достижение пользователя."""

    code: str
    title: str
    description: str
    awarded_at: str


class GamificationRead(BaseModel):
    """Сводное состояние геймификации пользователя."""

    xp: int
    level: int
    streak: int
    gems: int
    # Жизни и запас заморозок нужны клиенту, чтобы показывать реальный
    # остаток (раньше каждый урок начинался с локальных 3 жизней, а
    # купленное «Пополнение жизней» ни на что не влияло).
    lives: int = 5
    max_lives: int = 5
    # Через сколько секунд восстановится следующая жизнь (0 — запас полный).
    next_life_in_seconds: int = 0
    regen_minutes: int = 20
    streak_freezes: int = 0
    next_level_xp: int
    achievements: list[AchievementRead]


class LivesRead(BaseModel):
    """Состояние жизней: остаток и таймер восстановления."""

    lives: int
    max_lives: int = 5
    next_life_in_seconds: int = 0
    regen_minutes: int = 20


class DailyGoalRead(BaseModel):
    """Прогресс по ежедневной цели."""

    goal: int
    done: int
    remaining: int
    completed: bool
    day: str


class XpAddIn(BaseModel):
    """Начисление XP (внутреннее использование/тесты)."""

    amount: int = Field(ge=1, le=10000)


class XpAddOut(BaseModel):
    """Результат начисления XP."""

    xp: int
    level: int
    streak: int
    leveled_up: bool


class LeaderboardEntry(BaseModel):
    """Строка таблицы лидеров."""

    position: int
    name: str
    level: int
    xp: int
    is_me: bool


class LeaderboardRead(BaseModel):
    """Таблица лидеров по выбранной лиге."""

    league: str
    next_league: str
    entries: list[LeaderboardEntry]
    my_position: int | None


class ShopPurchaseIn(BaseModel):
    """Покупка товара за гемы."""

    item: str = Field(min_length=1, max_length=64)


class ShopPurchaseOut(BaseModel):
    """Результат покупки за гемы."""

    item: str
    spent: int
    gems: int
    # Что именно выдано за гемы: жизни, XP, предмет гардероба, заморозка стрика.
    effect: dict = Field(default_factory=dict)
