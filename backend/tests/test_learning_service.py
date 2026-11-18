"""Pure tests for adaptive-learning service helpers."""

import uuid

import pytest

from app.modules.learning.service import adaptive_score, new_competency_state


def test_new_competency_state_has_usable_numeric_defaults() -> None:
    """A new ORM state can be updated before it is flushed to the database."""
    state = new_competency_state(uuid.uuid4(), uuid.uuid4())

    state.attempts += 1
    state.correct_count += 1
    state.mastery += 0.12

    assert state.attempts == 1
    assert state.correct_count == 1
    assert state.mastery == pytest.approx(0.12)
    assert state.confidence == 0.0


def test_adaptive_score_prefers_weaker_competency() -> None:
    assert adaptive_score(0.9, 0.5) > adaptive_score(0.2, 0.5)


def test_adaptive_score_prefers_lower_difficulty_when_weakness_equal() -> None:
    assert adaptive_score(0.5, 0.2) > adaptive_score(0.5, 0.8)


def test_adaptive_score_is_bounded_for_normal_inputs() -> None:
    assert 0 <= adaptive_score(0, 1) <= 1
    assert 0 <= adaptive_score(1, 0) <= 1

class TestReviewGate:
    """Непроверенный юристом кейс не должен попадать пользователю.

    Импорт из паков и админки ставит ``review_status = "imported"`` — то есть
    «загружено, но не проверено». До этого гейта такие кейсы отдавались в
    ``/learning/next`` и в диагностику наравне с проверенными.
    """

    def test_only_approved_is_visible(self) -> None:
        from app.modules.learning.models import CaseVersion
        from app.modules.learning.service import is_user_visible

        for review_status, expected in (
            ("approved", True),
            ("imported", False),
            ("in_review", False),
            # Неизвестный статус (новая стадия проверки) тоже не пропускаем:
            # белый список безопасен по умолчанию.
            ("rejected", False),
        ):
            version = CaseVersion(review_status=review_status)
            assert is_user_visible(version) is expected, review_status

    def test_published_review_status_matches_importer_vocabulary(self) -> None:
        """Статус гейта существует в словаре импортёра — иначе тихо не совпадёт."""
        from app.modules.learning.importer import REVIEW_STATUSES
        from app.modules.learning.service import PUBLISHED_REVIEW_STATUS

        assert PUBLISHED_REVIEW_STATUS in REVIEW_STATUSES

    @pytest.mark.asyncio
    async def test_next_case_skips_unreviewed_and_returns_approved(self) -> None:
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from app.database import Base
        from app.modules.learning import service as learning_service
        from app.modules.learning.models import (
            CaseAnswer,
            CaseStep,
            CaseVersion,
            LearningCase,
        )

        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(bind=engine, expire_on_commit=False)

        async def _add_case(session, title: str, review_status: str) -> None:
            case = LearningCase(title=title, status="published")
            session.add(case)
            await session.flush()
            version = CaseVersion(
                case_id=case.id,
                version=1,
                situation=f"{title}: ситуация",
                difficulty=0.3,
                status="published",
                review_status=review_status,
                source_slug=title,
            )
            session.add(version)
            await session.flush()
            step = CaseStep(case_version_id=version.id, position=1, prompt="Как поступить?")
            session.add(step)
            await session.flush()
            session.add(
                CaseAnswer(step_id=step.id, text="Верно", is_correct=True)
            )
            session.add(
                CaseAnswer(step_id=step.id, text="Неверно", is_correct=False)
            )

        async with factory() as session:
            await _add_case(session, "unreviewed", "imported")
            await _add_case(session, "approved", "approved")
            await session.commit()

            payload = await learning_service.next_case(session, uuid.uuid4())

            assert payload is not None, "утверждённый кейс должен быть доступен"
            assert payload["situation"].startswith("approved")

        await engine.dispose()

    @pytest.mark.asyncio
    async def test_next_case_returns_none_when_nothing_approved(self) -> None:
        """Пустая лента вместо непроверенного контента — ожидаемое поведение."""
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from app.database import Base
        from app.modules.learning import service as learning_service
        from app.modules.learning.models import CaseVersion, LearningCase

        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(bind=engine, expire_on_commit=False)

        async with factory() as session:
            case = LearningCase(title="only-imported", status="published")
            session.add(case)
            await session.flush()
            session.add(
                CaseVersion(
                    case_id=case.id,
                    version=1,
                    situation="Импортировано, но не проверено",
                    difficulty=0.5,
                    status="published",
                    review_status="imported",
                    source_slug="only-imported",
                )
            )
            await session.commit()

            assert await learning_service.next_case(session, uuid.uuid4()) is None

        await engine.dispose()

    @pytest.mark.asyncio
    async def test_evaluate_rejects_unreviewed_case(self) -> None:
        """Ответ на снятый с показа кейс отклоняется, а не пишется в попытки."""
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from app.database import Base
        from app.modules.learning import service as learning_service
        from app.modules.learning.models import (
            Attempt,
            CaseAnswer,
            CaseStep,
            CaseVersion,
            LearningCase,
        )
        from app.modules.learning.schemas import AttemptCreate

        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(bind=engine, expire_on_commit=False)

        async with factory() as session:
            case = LearningCase(title="flipped", status="published")
            session.add(case)
            await session.flush()
            version = CaseVersion(
                case_id=case.id,
                version=1,
                situation="Снято с показа после начала сессии",
                difficulty=0.5,
                status="published",
                review_status="in_review",
                source_slug="flipped",
            )
            session.add(version)
            await session.flush()
            step = CaseStep(case_version_id=version.id, position=1, prompt="Как поступить?")
            session.add(step)
            await session.flush()
            answer = CaseAnswer(step_id=step.id, text="Верно", is_correct=True)
            session.add(answer)
            await session.commit()

            with pytest.raises(learning_service.LearningError) as exc:
                await learning_service.evaluate(
                    session,
                    uuid.uuid4(),
                    AttemptCreate(
                        case_version_id=version.id,
                        step_id=step.id,
                        answer_id=answer.id,
                    ),
                )
            assert "проверку" in str(exc.value)

            from sqlalchemy import func, select

            count = await session.scalar(select(func.count()).select_from(Attempt))
            assert count == 0

        await engine.dispose()


class TestUnavailableReason:
    """Пустая лента должна объяснять причину, а не выдавать «всё пройдено».

    Клиент показывал золотую грамоту «Все доступные кейсы пройдены» на любой
    ``null`` от сервера — включая случай, когда в банке нет ни одного
    проверенного кейса. Пользователь не проходил ничего, а получал достижение.
    """

    @staticmethod
    async def _session_with(cases: list[tuple[str, str]]):
        """Готовит БД с кейсами ``(source_slug, review_status)``."""
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from app.database import Base
        from app.modules.learning.models import CaseVersion, LearningCase

        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(bind=engine, expire_on_commit=False)
        session = factory()
        for slug, review_status in cases:
            case = LearningCase(title=slug, status="published")
            session.add(case)
            await session.flush()
            session.add(
                CaseVersion(
                    case_id=case.id,
                    version=1,
                    situation=slug,
                    difficulty=0.5,
                    status="published",
                    review_status=review_status,
                    source_slug=slug,
                )
            )
        await session.commit()
        return engine, session

    @pytest.mark.asyncio
    async def test_empty_bank_reports_no_content(self) -> None:
        from app.modules.learning import service as learning_service

        engine, session = await self._session_with([])
        try:
            assert await learning_service.unavailable_reason(session) == "no_content"
        finally:
            await session.close()
            await engine.dispose()

    @pytest.mark.asyncio
    async def test_imported_only_bank_reports_awaiting_review(self) -> None:
        """Кейсы есть, но не проверены — это не «нет контента»."""
        from app.modules.learning import service as learning_service

        engine, session = await self._session_with([("a", "imported"), ("b", "in_review")])
        try:
            assert await learning_service.unavailable_reason(session) == "awaiting_review"
        finally:
            await session.close()
            await engine.dispose()

    @pytest.mark.asyncio
    async def test_approved_content_reports_nothing(self) -> None:
        """Есть что показать — причина не нужна, иначе клиент покажет заглушку."""
        from app.modules.learning import service as learning_service

        engine, session = await self._session_with([("a", "imported"), ("b", "approved")])
        try:
            assert await learning_service.unavailable_reason(session) is None
        finally:
            await session.close()
            await engine.dispose()

    def test_assessment_start_schema_carries_reason(self) -> None:
        """Причина обязана доезжать до клиента в схеме ответа."""
        from app.modules.learning.schemas import AssessmentStart

        payload = AssessmentStart(session_id=uuid.uuid4(), case=None)
        assert payload.unavailable_reason is None

        payload = AssessmentStart(
            session_id=uuid.uuid4(), case=None, unavailable_reason="awaiting_review"
        )
        assert payload.unavailable_reason == "awaiting_review"
