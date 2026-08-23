"""Сид-данные для контента LexBear (юниты, уроки, теория, вопросы, статьи, кейсы).

Данные перенесены из веб-проекта (src/lib/seed.ts) и адаптированы
под ORM-модели FastAPI.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.lexbear_models import (
    Article,
    LexBearLesson,
    Question,
    TheoryCard,
    Unit,
)
from app.modules.content.models import Case, CaseOption


async def run_lexbear_seed(session: AsyncSession) -> dict:
    """Заполняет таблицы LexBear демо-данными (идемпотентно).

    Если юниты уже существуют — пропускаем.
    """
    existing = await session.scalar(select(Unit.id).limit(1))
    if existing is not None:
        return {"skipped": True}

    # ==== Юниты ====
    const = Unit(
        code="const",
        codex="Конституция",
        title="Конституция РФ",
        subtitle="Права, обязанности, основы строя",
        order=1,
        color="#3a9dc9",
        locked=False,
        why_practical="Понимаешь, откуда растут все твои права.",
    )
    prop = Unit(
        code="uk-property",
        codex="УК",
        title="УК: собственность",
        subtitle="Кража, грабёж, разбой",
        order=2,
        color="#C9A227",
        locked=False,
        why_practical="Отличать кражу от грабежа за 3 секунды.",
    )
    fraud = Unit(
        code="uk-fraud",
        codex="УК",
        title="Мошенничество 159",
        subtitle="Обман и злоупотребление доверием",
        order=3,
        color="#e6784c",
        locked=False,
        why_practical="Самая частая статья XXI века.",
    )
    road = Unit(
        code="koap-road",
        codex="КоАП",
        title="КоАП: дорога",
        subtitle="ПДД, штрафы, лишение",
        order=4,
        color="#8a5cf6",
        locked=True,
        why_practical="Знать свои штрафы дешевле, чем платить.",
    )
    tk = Unit(
        code="tk",
        codex="ТК",
        title="Трудовой кодекс",
        subtitle="Приём, увольнение, зарплата",
        order=5,
        color="#43A35D",
        locked=True,
        why_practical="Работодатель не выше закона.",
    )
    session.add_all([const, prop, fraud, road, tk])
    await session.flush()

    # ==== Уроки ====
    l_krazha = LexBearLesson(unit_id=prop.id, title="Ст. 158 — Кража", order=1, xp_reward=15)
    l_grabezh = LexBearLesson(unit_id=prop.id, title="Ст. 161 — Грабёж", order=2, xp_reward=15)
    l_razboy = LexBearLesson(unit_id=prop.id, title="Ст. 162 — Разбой", order=3, xp_reward=20)
    l_159 = LexBearLesson(unit_id=fraud.id, title="Ст. 159 — Мошенничество", order=1, xp_reward=15)
    l_159_3 = LexBearLesson(unit_id=fraud.id, title="Ст. 159 ч.3 — Крупный размер", order=2, xp_reward=20)
    l_const = LexBearLesson(unit_id=const.id, title="Базовые права человека", order=1, xp_reward=10)
    session.add_all([l_krazha, l_grabezh, l_razboy, l_159, l_159_3, l_const])
    await session.flush()

    # ==== Теория: 158 Кража ====
    session.add_all(
        [
            TheoryCard(
                lesson_id=l_krazha.id,
                order=1,
                title="Ст. 158 УК РФ — Кража",
                definition="Тайное хищение чужого имущества.",
                practical="Взял чужой телефон со стола в кафе, пока хозяин отвернулся, — это кража.",
                chips=["Тайность", "Хищение", "Чужое имущество"],
                bear_line="Главное — тайный характер. Никто не должен видеть.",
            ),
            TheoryCard(
                lesson_id=l_krazha.id,
                order=2,
                title="Признак: тайность",
                definition="Тайно — значит, посторонние не осознают факт хищения.",
                practical="Вытащил кошелёк в толпе метро — тайно.",
                chips=["Незаметно", "Скрытно", "Обстановка"],
                bear_line="Тайно ≠ в темноте. Тайно = скрытно для потерпевшего.",
            ),
            TheoryCard(
                lesson_id=l_krazha.id,
                order=3,
                title="Когда кража становится грабежом",
                definition="Если в момент хищения тайность утрачена — это уже ст. 161.",
                practical="Хозяин заметил и крикнул, а ты всё равно убегаешь — грабёж.",
                chips=["Открытость", "Продолжение", "161 УК"],
                bear_line="Заметили — и ты не остановился? Это уже грабёж.",
            ),
        ]
    )

    # ==== Вопросы: 158 ====
    session.add_all(
        [
            Question(
                lesson_id=l_krazha.id,
                order=1,
                kind="case",
                prompt="Как квалифицировать?",
                case_text="Мужчина взял телефон со стола в кафе, пока владелец отвернулся. Никто не заметил.",
                options=["Ст. 158 УК — Кража", "Ст. 159 УК — Мошенничество", "Ст. 161 УК — Грабёж", "КоАП 7.27"],
                correct=0,
                explanation="Тайное хищение чужого имущества — это ст. 158.",
            ),
            Question(
                lesson_id=l_krazha.id,
                order=2,
                kind="truefalse",
                prompt="Если стоимость украденного меньше 2500 ₽, это КоАП 7.27, а не уголовное дело.",
                options=["Верно", "Неверно"],
                correct=0,
                explanation="Да. До 2500 ₽ — административка.",
            ),
            Question(
                lesson_id=l_krazha.id,
                order=3,
                kind="choice",
                prompt="Выбери главный признак кражи:",
                options=["Насилие", "Тайность", "Обман", "Угроза"],
                correct=1,
                explanation="Тайность отличает кражу от грабежа и разбоя.",
            ),
        ]
    )

    # ==== Теория и вопросы: 161 Грабёж ====
    session.add(
        TheoryCard(
            lesson_id=l_grabezh.id,
            order=1,
            title="Ст. 161 УК — Грабёж",
            definition="Открытое хищение чужого имущества.",
            practical="Выхватил сумку из рук прохожего и убежал — все видели.",
            chips=["Открытость", "Хищение", "Без насилия*"],
            bear_line="Открыто — потерпевший осознаёт, что имущество отнимают.",
        )
    )
    session.add(
        Question(
            lesson_id=l_grabezh.id,
            order=1,
            kind="case",
            prompt="Как квалифицировать?",
            case_text="Подросток сорвал цепочку с шеи прохожей и убежал. Насилие не применял.",
            options=["Ст. 158 — Кража", "Ст. 161 — Грабёж", "Ст. 162 — Разбой", "Ст. 213 — Хулиганство"],
            correct=1,
            explanation="Открыто, без опасного насилия — ст. 161.",
        )
    )

    # ==== Теория и вопросы: 162 Разбой ====
    session.add(
        TheoryCard(
            lesson_id=l_razboy.id,
            order=1,
            title="Ст. 162 УК — Разбой",
            definition="Нападение с насилием, опасным для жизни, либо угрозой такого насилия.",
            practical="Напал с ножом, потребовал деньги — разбой, даже если ничего не забрал.",
            chips=["Нападение", "Опасное насилие", "Усечённый состав"],
            bear_line="Разбой окончен с момента нападения.",
        )
    )
    session.add(
        Question(
            lesson_id=l_razboy.id,
            order=1,
            kind="case",
            prompt="Квалификация?",
            case_text="Двое в масках вошли в магазин, направили нож на кассира, забрали 15 000 ₽.",
            options=["Ст. 158", "Ст. 161", "Ст. 162", "Ст. 163"],
            correct=2,
            explanation="Нападение + угроза ножом = разбой (162).",
        )
    )

    # ==== Теория и вопросы: 159 Мошенничество ====
    session.add(
        TheoryCard(
            lesson_id=l_159.id,
            order=1,
            title="Ст. 159 УК — Мошенничество",
            definition="Хищение путём обмана или злоупотребления доверием.",
            practical="Продал несуществующий телефон, взял предоплату и пропал.",
            chips=["Обман", "Злоупотребление доверием", "Добровольная передача"],
            bear_line="Ключ — жертва отдаёт имущество САМА, потому что её обманули.",
        )
    )
    session.add(
        Question(
            lesson_id=l_159.id,
            order=1,
            kind="case",
            prompt="Квалификация?",
            case_text="Незнакомец представился сотрудником банка и убедил перевести 120 000 ₽ «на безопасный счёт».",
            options=["Ст. 158", "Ст. 159", "Ст. 163", "КоАП 14.1"],
            correct=1,
            explanation="Классический телефонный обман — ст. 159.",
        )
    )

    # ==== Конституция ====
    session.add(
        TheoryCard(
            lesson_id=l_const.id,
            order=1,
            title="Ст. 20 — Право на жизнь",
            definition="Каждый имеет право на жизнь.",
            practical="Мораторий на смертную казнь действует с 1996 года.",
            chips=["Право на жизнь", "Мораторий", "ЕСПЧ"],
            bear_line="Это база.",
        )
    )
    session.add(
        Question(
            lesson_id=l_const.id,
            order=1,
            kind="choice",
            prompt="Какая статья Конституции защищает жилище?",
            options=["Ст. 20", "Ст. 25", "Ст. 29", "Ст. 51"],
            correct=1,
            explanation="Ст. 25 — неприкосновенность жилища.",
        )
    )

    # ==== Статьи ====
    session.add_all(
        [
            Article(code="УК-158", codex="УК", number="158", title="Кража", plain="Тайно взял чужое — статья 158.", full="Тайное хищение чужого имущества. Ч.1 — до 2 лет."),
            Article(code="УК-159", codex="УК", number="159", title="Мошенничество", plain="Обманул, и жертва отдала сама — статья 159.", full="Хищение путём обмана. Ч.1 — до 2 лет."),
            Article(code="УК-161", codex="УК", number="161", title="Грабёж", plain="Отнял открыто, все видели — 161.", full="Открытое хищение. Ч.1 — до 4 лет."),
            Article(code="УК-162", codex="УК", number="162", title="Разбой", plain="Напал с угрозой жизни ради имущества — 162.", full="Нападение с опасным насилием. Ч.1 — до 8 лет."),
            Article(code="КРФ-25", codex="Конституция", number="25", title="Неприкосновенность жилища", plain="Без решения суда в дом не войдут.", full="Жилище неприкосновенно. Только по решению суда или закону."),
            Article(code="КРФ-51", codex="Конституция", number="51", title="Свидетельский иммунитет", plain="Против себя и близких можешь молчать.", full="Никто не обязан свидетельствовать против себя и близких."),
        ]
    )

    # ==== Кейсы (вкладка «Кейсы») ====
    _add_case(
        session,
        title="Телефон в кафе",
        codex="УК",
        difficulty="easy",
        case_text="Мужчина взял телефон со стола в кафе, пока владелец отвернулся. Никто не заметил.",
        options=[
            ("Ст. 158 УК", True, "Тайное хищение = кража."),
            ("Ст. 159 УК", False, "Обмана не было."),
            ("Ст. 161 УК", False, "Не открытое."),
            ("КоАП 7.27", False, "Размер крупный."),
        ],
        featured=True,
    )
    _add_case(
        session,
        title="Звонок «из банка»",
        codex="УК",
        difficulty="easy",
        case_text="«Сотрудник банка» убедил перевести 100 000 ₽ на «безопасный счёт». Жертва перевела сама.",
        options=[
            ("Ст. 158", False, "Не тайное."),
            ("Ст. 159", True, "Обман + добровольная передача = мошенничество."),
            ("Ст. 163", False, "Вымогательства нет."),
            ("КоАП", False, "Уголовное дело."),
        ],
        featured=False,
    )
    _add_case(
        session,
        title="Сорвал цепочку",
        codex="УК",
        difficulty="medium",
        case_text="Сорвал цепочку с шеи прохожей и убежал. Свидетели были. Насилие не применял.",
        options=[
            ("Ст. 158", False, "Тайного нет."),
            ("Ст. 161", True, "Открыто, без опасного насилия = грабёж."),
            ("Ст. 162", False, "Опасного насилия нет."),
            ("Ст. 213", False, "Не хулиганство."),
        ],
        featured=False,
    )
    _add_case(
        session,
        title="Магазин под ножом",
        codex="УК",
        difficulty="hard",
        case_text="Двое в масках с ножом ворвались в магазин, потребовали кассу. Забрали 15 000 ₽.",
        options=[
            ("Ст. 158", False, "Нападение, не тайно."),
            ("Ст. 161", False, "Опасное насилие."),
            ("Ст. 162", True, "Нападение с угрозой опасным насилием группой лиц."),
            ("Ст. 163", False, "Не вымогательство."),
        ],
        featured=False,
    )
    _add_case(
        session,
        title="Обыск без бумаги",
        codex="Конституция",
        difficulty="medium",
        case_text="Полиция без решения суда и без экстренных оснований пытается войти в квартиру.",
        options=[
            ("Пустить, спорить потом", False, "Ст. 25 защищает."),
            ("Требовать судебное решение (ст. 25)", True, "Жилище неприкосновенно."),
            ("Позвать соседей", False, "Не ключевое."),
            ("Согласиться письменно", False, "Без основания."),
        ],
        featured=False,
    )

    await session.commit()
    return {"skipped": False}


def _add_case(
    session: AsyncSession,
    *,
    title: str,
    codex: str,
    difficulty: str,
    case_text: str,
    options: list[tuple[str, bool, str]],
    featured: bool,
) -> None:
    """Создаёт кейс с вариантами ответов."""
    case = Case(
        title=title,
        codex=codex,
        difficulty=difficulty,
        case_text=case_text,
        situation=case_text,
        correct=next(i for i, (_, is_correct, _) in enumerate(options) if is_correct),
        featured=featured,
    )
    session.add(case)
    session.flush()
    for text, is_correct, explanation in options:
        session.add(
            CaseOption(
                case_id=case.id,
                text=text,
                is_correct=is_correct,
                explanation=explanation,
            )
        )