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


async def seed_lexbear() -> None:
    """Populate LexBear content (units, lessons, articles, cases) from JSON packs."""
    async with async_session_factory() as session:
        report = await lexbear_seed.run_lexbear_seed(session)
        await session.commit()
        print("lexbear seed:", report)


async def seed_all() -> None:
    """Сид целиком в одном event loop.

    Раньше было два отдельных ``asyncio.run``. Асинхронный движок SQLAlchemy
    создаёт пул один раз на процесс, и asyncpg-соединения из него привязаны к
    тому loop, где открылись: во втором ``asyncio.run`` они падали с
    «got Future attached to a different loop». Локально на sqlite это не
    воспроизводилось, а в CI на Postgres сид падал всегда — то есть прод-сид
    (Railway: ``alembic upgrade head`` + сид контента) не работал вовсе.
    """
    await seed_learning()
    await seed_lexbear()
    # Закрываем пул, пока loop ещё жив.
    from app.database import dispose_engine

    await dispose_engine()


if __name__ == "__main__":
    asyncio.run(seed_all())
