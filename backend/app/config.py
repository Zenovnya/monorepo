# CORS: список разрешённых источников (пустой — все закрыты).
    cors_origins: list[str] = []

    # ЮKassa (платежи)
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    yookassa_webhook_secret: str = ""

    model_config = SettingsConfigDict(