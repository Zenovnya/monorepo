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
from app.modules.content import lexbear_seed
from app.modules.learning.seed import seed_starter_content


async def seed_learning() -> None:
    """Populate the adaptive learning starter bank."""
    async with async_session_factory() as session:
        await seed_starter_content(session)
        await session.commit()


async def seed_lexbear() -> None:
    """Populate LexBear content (units, lessons, articles, cases) from JSON packs."""
    async with async_session_factory() as session:
        report = await lexbear_seed.run_lexbear_seed(session)
        await session.commit()
        print("lexbear seed:", report)


if __name__ == "__main__":
    asyncio.run(seed_learning())
    asyncio.run(seed_lexbear())