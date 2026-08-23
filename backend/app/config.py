"""Настройки приложения через переменные окружения (pydantic-settings)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Конфигурация приложения.

    Значения читаются из переменных окружения (или файла ``.env``).
    Переменные с префиксом отсутствуют — имена совпадают с названиями полей.
    """

    # --- Приложение ---
    app_name: str = "LexBear API"
    debug: bool = False

    # --- База данных ---
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/sourcecraft"
    )

    # --- Безопасность / JWT ---
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:19006", "http://localhost:8081"]

    # --- ЮKassa (платежи) ---
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    yookassa_webhook_secret: str = ""

    # --- Аналитика ---
    amplitude_api_key: str = ""

    # --- Мониторинг ошибок ---
    sentry_dsn: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def model_post_init(self, __context) -> None:
        """Валидация: запрещаем небезопасный JWT-секрет в проде."""
        if not self.debug and len(self.jwt_secret_key or "") < 32:
            raise ValueError(
                "JWT_SECRET_KEY должен быть задан и содержать минимум 32 символа"
                " (для production)."
            )


def get_settings() -> Settings:
    """Возвращает настроенный экземпляр настроек (кешируется)."""
    return Settings()