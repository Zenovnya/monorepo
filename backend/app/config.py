"""Конфигурация приложения.

Настройки загружаются из переменных окружения и файла .env.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Базовые настройки приложения."""

    app_name: str = "SourceCraft API"
    debug: bool = False

    # База данных (PostgreSQL по умолчанию, переопределяется через .env)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/sourcecraft"

    # Сервер
    host: str = "0.0.0.0"
    port: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    """Возвращает кэшированный экземпляр настроек."""
    return Settings()