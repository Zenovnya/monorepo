"""Настройки приложения через переменные окружения (pydantic-settings)."""

import json
from functools import lru_cache

from pydantic import field_validator
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
    # Перед регуляркой допускаем всё, что похоже на LAN-адрес dev-машины:
    # Expo Metro (:8081) и Expo Web (:19006) на телефоне/эмуляторе. Удобно для
    # запуска в Expo Go с iPhone — менять значение при смене IP не нужно.
    # Необязательное регулярное выражение для динамических dev-origin (например,
    # LAN-адреса Expo). В production оставляйте пустым и используйте allowlist.
    cors_origin_regex: str | None = None

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

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        """Нормализует CORS_ORIGINS до разбора полей.

        pydantic-settings ждёт для ``list[str]`` JSON-массив, и запись
        ``CORS_ORIGINS=http://a,http://b`` в `.env` падает с SettingsError.
        Оборачиваем dotenv-источник, чтобы принимать и обычный список.
        """
        from pydantic_settings import DotEnvSettingsSource

        class _DotEnvSource(DotEnvSettingsSource):
            def prepare_field_value(self, field_name, field, value, value_is_complex):
                # Нормализуем ДО json.loads — иначе строка через запятую падает.
                if field_name == "cors_origins" and isinstance(value, str):
                    return cls._split_list(value)
                return super().prepare_field_value(
                    field_name, field, value, value_is_complex
                )

        return (
            init_settings,
            env_settings,
            _DotEnvSource(
                settings_cls,
                env_file=settings_cls.model_config.get("env_file"),
                env_file_encoding=settings_cls.model_config.get("env_file_encoding"),
            ),
            file_secret_settings,
        )

    @staticmethod
    def _split_list(value):
        """Разбирает список из строки: ``a,b,c`` или JSON-массив."""
        if not isinstance(value, str):
            return value
        raw = value.strip()
        if not raw:
            return []
        if raw[0] == "[":
            try:
                return [str(item).strip() for item in json.loads(raw)]
            except (ValueError, TypeError):
                pass
        return [item.strip().strip("\"'") for item in raw.split(",") if item.strip()]

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
