# ЮKassa (платежи)
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    yookassa_webhook_secret: str = ""

    # Аналитика
    amplitude_api_key: str = ""

    # Мониторинг ошибок
    sentry_dsn: str = ""

    model_config = SettingsConfigDict(