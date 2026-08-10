"""Конфигурация приложения.

Настройки загружаются из переменных окружения и файла .env.
"""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Небезопасный секрет, который запрещено использовать в production.
_INSECURE_JWT_SECRET = "change-me-in-production"


class Settings(BaseSettings):
    """Базовые настройки приложения."""

    app_name: str = "SourceCraft API"
    debug: bool = False

    # База данных (PostgreSQL по умолчанию, переопределяется через .env)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/sourcecraft"

    # Сервер
    host: str = "0.0.0.0"
    port: int = 8000

    # Аутентификация
    jwt_secret_key: str = _INSECURE_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # CORS: список разрешённых источников (пустой — все закрыты).
    cors_origins: list[str] = []

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @model_validator(mode="after")
    def _validate_security(self) -> "Settings":
        """Запрещает небезопасный секрет и неактивную отладку в production."""
        if self.debug is False and self.jwt_secret_key == _INSECURE_JWT_SECRET:
            raise ValueError(
                "jwt_secret_key должен быть задан через .env "
                "(не используйте значение по умолчанию в production)"
            )
        if self.debug is True:
            raise ValueError(
                "debug=True запрещён: включение debug в production "
                "раскрывает внутренние детали и SQL-запросы"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Возвращает кэшированный экземпляр настроек."""
    return Settings()