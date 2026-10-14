"""Idempotent starter content for local development and a clean MVP database."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.learning.models import (
    CaseAnswer, CaseCompetency, CaseStep, CaseVersion, Competency,
    Domain, LearningCase, Topic,
)


async def seed_starter_content(session: AsyncSession) -> None:
    """Create one published competency and case when the learning bank is empty."""
    existing = await session.scalar(select(Domain).where(Domain.slug == "police-contact"))
    if existing:
        return

    domain = Domain(title="Взаимодействие с полицией", slug="police-contact")
    session.add(domain)
    await session.flush()
    topic = Topic(domain_id=domain.id, title="Проверка документов", slug="document-check")
    session.add(topic)
    await session.flush()
    competency = Competency(
        topic_id=topic.id,
        title="Понимать основания проверки документов",
        slug="document-check-grounds",
        description="Пользователь различает законное требование и произвольную просьбу.",
        importance=1.0,
    )
    session.add(competency)
    case = LearningCase(title="Проверка документов", status="published")
    session.add(case)
    await session.flush()
    version = CaseVersion(
        case_id=case.id,
        version=1,
        situation="Сотрудник полиции просит предъявить документы на улице.",
        difficulty=0.35,
        status="published",
    )
    session.add(version)
    await session.flush()
    step = CaseStep(case_version_id=version.id, position=1, prompt="Как лучше действовать в первую очередь?")
    session.add(step)
    await session.flush()
    session.add_all([
        CaseAnswer(step_id=step.id, text="Спокойно уточнить основание требования и предъявить документ при наличии основания", is_correct=True, explanation="Попросите назвать основание проверки и действуйте спокойно."),
        CaseAnswer(step_id=step.id, text="Сразу убежать", is_correct=False, error_type="risky_behavior", explanation="Бегство может создать дополнительные риски."),
        CaseAnswer(step_id=step.id, text="Разорвать документ", is_correct=False, error_type="risky_behavior", explanation="Не уничтожайте документы и не обостряйте ситуацию."),
    ])
    session.add(CaseCompetency(case_version_id=version.id, competency_id=competency.id, weight=1.0))