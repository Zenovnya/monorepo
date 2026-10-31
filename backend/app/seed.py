from app.modules.mascot import models as mascot_models  # noqa: F401
from app.modules.notifications import models as notifications_models  # noqa: F401
from app.modules.payments import models as payments_models  # noqa: F401
from app.modules.progress import models as progress_models  # noqa: F401
from app.modules.content import lexbear_models  # noqa: F401
from app.modules.content.lexbear_models import (  # noqa: F401
    Article,
    LearnedArticle,
    Question,
    TheoryCard,
    Unit,
)

import asyncio

from app.database import async_session_factory
from app.modules.learning.importer import import_cases
from app.modules.learning.seed import seed_starter_content


async def seed_learning() -> None:
    """Populate the adaptive learning bank.

    Сначала создаётся минимальный стартовый кейс (чтобы банк никогда не был
    пустым), затем контент-паки импортируются в тот же адаптивный банк —
    иначе ``GET /learning/next`` выбирал бы из одной позиции.
    """
    async with async_session_factory() as session:
        await seed_starter_content(session)
        await import_cases(session)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_learning())
