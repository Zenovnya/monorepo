import asyncio

from sqlalchemy import select

from app.database import Base, async_session_factory, engine
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.auth.models import User
from app.modules.auth.service import hash_password
from app.modules.content import models as content_models  # noqa: F401
from app.modules.content.models import Branch, Case, CaseOption, Lesson
from app.modules.mascot import models as mascot_models  # noqa: F401
from app.modules.mascot.models import MascotPhrase
from app.modules.progress import models as progress_models  # noqa: F401