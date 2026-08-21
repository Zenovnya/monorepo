@router.post(
    "/pet",
    response_model=PetCountRead,
)
async def pet(
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> PetCountRead:
    """Погладить маскота: увеличивает счётчик поглаживаний."""
    user_id = _get_current_user_id(authorization)
    pet_count = await service.increment_pet_count(session, user_id)
    await session.commit()

    # Отправляем событие аналитики (fire-and-forget, не блокирует ответ).
    from app.modules.analytics import service as analytics_service

    await analytics_service.track_mascot_petted(user_id)

    return PetCountRead(pet_count=pet_count)