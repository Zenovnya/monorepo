"""Настройки приложения через переменные окружения (pydantic-settings)."""

from functools import lru_cache

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

    # --- Админ-доступ (сид/управление контентом) ---
    # Токен для защищённых служебных эндпоинтов (сид и CRUD контента).
    # Передаётся клиентом в заголовке ``X-Admin-Token``. Если не задан —
    # админ-эндпоинты недоступны в production (в debug разрешены для удобства).
    admin_token: str = ""

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:19006", "http://localhost:8081"]

    # --- Прокси ---
    # Включайте в production, если приложение работает за доверенным реверс-
    # прокси (nginx, облачный балансировщик). Тогда IP клиента для rate-limit
    # берётся из X-Forwarded-For, а не из адреса прокси. По умолчанию выключено
    # — иначе заголовок можно подделать при прямом доступе к приложению.
    trust_proxy_headers: bool = False

    # --- Платежи (общий слой, провайдеро-независимый) ---
    # Активный платёжный провайдер: "" (заглушка/manual) | "robokassa" |
    # "prodamus" | "yoomoney" | "cloudpayments" | "yookassa" | ...
    # Реализация выбирается в app.modules.payments.providers.
    payment_provider: str = ""
    # Общий секрет для проверки HMAC-подписи webhook платёжного шлюза.
    payments_webhook_secret: str = ""
    # URL возврата пользователя после оплаты (в приложение/на страницу).
    payments_return_url: str = ""

    # --- ЮKassa (наследие; используется провайдером yookassa, если включён) ---
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


@lru_cache
def get_settings() -> Settings:
    """Возвращает настроенный экземпляр настроек (кешируется)."""
    return Settings()