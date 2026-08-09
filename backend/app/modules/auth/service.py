def get_bearer_token(
    authorization: str | None = Header(default=None),
) -> str:
    """FastAPI-зависимость: извлекает токен из заголовка Authorization."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Отсутствует Bearer-токен",
        )
    return authorization.split(" ", 1)[1].strip()