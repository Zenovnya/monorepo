@router.post("/answer", response_model=ProgressAnswerOut)
async def progress_answer(
    data: ProgressAnswerIn,
    authorization: str = Depends(auth_service.get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Обрабатывает ответ на кейс и обновляет SRS."""
    user_id = _get_current_user_id(authorization)
    try:
        result = await service.answer_case(
            session,
            user_id,
            data.case_id,
            data.option_id,
            quality=data.quality,
        )
    except service.ProgressError as exc:
        raise _to_http_error(exc) from exc
    await session.commit()

    # Аналитика: событие следования подсказке LexEntrance.
    if result.get("correct"):
        from app.modules.analytics import service as analytics_service

        await analytics_service.track_lex_entrance_hint_followed(
            user_id, str(data.case_id)
        )

    return result