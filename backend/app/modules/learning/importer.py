"""Импорт кейсов из контент-паков в адаптивный банк.

Единый контентный механизм
-------------------------
В репозитории исторически существовали два параллельных пайплайна контента:

1. legacy — ``units → lexbear_lessons → questions`` и ``cases → case_options``
   (питает ``/lexbear/*`` — вкладки «Учёба» и «Кейсы»);
2. адаптивный — ``learning_cases → learning_case_versions → learning_case_steps
   → learning_case_answers`` + ``learning_competencies`` (питает ``/learning/*``).

Из-за этого 100 кейсов из ``app/content_packs/cases.json`` существовали только
в legacy-таблицах, а адаптивный движок выбирал из одного кейса, созданного
``seed_starter_content``. Этот модуль закрывает разрыв: он переносит кейсы
пака в адаптивный банк, не дублируя их при повторных запусках.

Маппинг
-------
===================  ==================================================
``cases.json``       адаптивный банк
===================  ==================================================
``slug``             ``LearningCase`` + ``CaseVersion.source_slug``
``codex``            ``Domain`` (один домен на кодекс)
``codex``            ``Topic`` («Кейсы по предмету <codex>»)
``slug``             ``Competency`` «Разбираться в ситуации: <title>»
``title``            ``LearningCase.title``
``case_text``        ``CaseVersion.situation``
``difficulty``       ``CaseVersion.difficulty`` (easy=0.3, medium=0.55, hard=0.8)
``options[].text``   ``CaseAnswer.text``
``options[].is_correct``  ``CaseAnswer.is_correct``
``options[].explanation`` ``CaseAnswer.explanation``
—                    ``CaseStep`` с промптом «Как лучше действовать?»
===================  ==================================================

Импорт ≠ юридическая проверка: ``CaseVersion.review_status`` остаётся
``imported`` до проверки экспертом (``in_review`` → ``approved``).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.learning.models import (
    CaseAnswer,
    CaseCompetency,
    CaseStep,
    CaseVersion,
    Competency,
    Domain,
    LearningCase,
    Topic,
)

# Каталог JSON-паков по умолчанию совпадает с legacy-загрузчиком.
DEFAULT_PACKS_DIR = Path(__file__).resolve().parents[2] / "content_packs"
CASES_FILENAME = "cases.json"
STEP_PROMPT = "Как лучше действовать в этой ситуации?"


def difficulty_to_float(value: object) -> float:
    """Переводит метку сложности (``easy``/``medium``/``hard``) в число 0..1."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
    else:
        number = DIFFICULTY_LABELS.get(
            str(value or "").strip().lower(), DEFAULT_DIFFICULTY
        )
    return round(min(1.0, max(0.0, number)), 4)


def read_cases_pack(packs_dir: Path | str | None = None) -> list[dict]:
    """Читает ``cases.json`` и возвращает список кейсов.

    Отсутствующий файл трактуется как пустой пак — как и в legacy-загрузчике.
    """
    directory = Path(packs_dir) if packs_dir is not None else DEFAULT_PACKS_DIR
    path = directory / CASES_FILENAME
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as fh:
        raw = json.load(fh)
    # Формат пака: {"cases": [...]}. «Голый» список тоже допустим (удобно в тестах).
    cases = raw.get("cases", []) if isinstance(raw, dict) else raw
    if not isinstance(cases, list):
        raise ContentImportError(f"{CASES_FILENAME}: ожидался список кейсов")
    return [case for case in cases if isinstance(case, dict)]


def validate_case(case: dict, index: int) -> str:
    """Проверяет обязательные поля кейса. Возвращает slug."""
    slug = str(case.get("slug") or "").strip()
    if not slug:
        raise ContentImportError(f"{CASES_FILENAME}: у кейса #{index} нет slug")
    if not str(case.get("title") or "").strip():
        raise ContentImportError(f"{CASES_FILENAME}: у кейса {slug!r} нет title")
    if not str(case.get("case_text") or "").strip():
        raise ContentImportError(f"{CASES_FILENAME}: у кейса {slug!r} нет case_text")
    options = case.get("options") or []
    if not isinstance(options, list) or len(options) < 2:
        raise ContentImportError(
            f"{CASES_FILENAME}: у кейса {slug!r} меньше двух вариантов ответа"
        )
    correct = [o for o in options if isinstance(o, dict) and o.get("is_correct")]
    if len(correct) != 1:
        raise ContentImportError(
            f"{CASES_FILENAME}: у кейса {slug!r} должен быть ровно один правильный "
            f"вариант (найдено {len(correct)})"
        )
    return slug


async def _get_or_create_domain(session: AsyncSession, codex: str) -> Domain:
    """Домен = кодекс (КоАП, ГК, ...). Создаётся один раз."""
    domain = await session.scalar(select(Domain).where(Domain.slug == codex))
    if domain is None:
        domain = Domain(title=codex, slug=codex)
        session.add(domain)
        await session.flush()
    return domain


async def _get_or_create_topic(
    session: AsyncSession, domain: Domain, codex: str
) -> Topic:
    """Тема внутри домена — все кейсы пака по данному кодексу."""
    topic = await session.scalar(
        select(Topic).where(Topic.domain_id == domain.id, Topic.slug == "cases")
    )
    if topic is None:
        topic = Topic(
            domain_id=domain.id,
            title=f"Кейсы по предмету «{codex}»"[:255],
            slug="cases",
        )
        session.add(topic)
        await session.flush()
    return topic


async def _get_or_create_competency(
    session: AsyncSession, topic: Topic, slug: str, title: str
) -> Competency:
    """Компетенция кейса — «уметь разобрать ситуацию <title>»."""
    competency = await session.scalar(
        select(Competency).where(
            Competency.topic_id == topic.id, Competency.slug == slug
        )
    )
    if competency is None:
        competency = Competency(
            topic_id=topic.id,
            title=f"Разбираться в ситуации: {title}"[:255],
            slug=slug[:128],
            importance=1.0,
        )
        session.add(competency)
        await session.flush()
    return competency


async def _get_or_create_version(
    session: AsyncSession, case: dict, slug: str, difficulty: float
) -> tuple[LearningCase, CaseVersion, bool]:
    """Находит или создаёт ``LearningCase`` и его версию по ``source_slug``."""
    version = await session.scalar(
        select(CaseVersion).where(CaseVersion.source_slug == slug)
    )
    if version is not None:
        learning_case = await session.get(LearningCase, version.case_id)
        return learning_case, version, False

    learning_case = LearningCase(title=str(case["title"])[:255], status="published")
    session.add(learning_case)
    await session.flush()
    version = CaseVersion(
        case_id=learning_case.id,
        version=1,
        situation=str(case["case_text"]),
        difficulty=difficulty,
        status="published",
        source_slug=slug,
        review_status="imported",
    )
    session.add(version)
    await session.flush()
    return learning_case, version, True


DIFFICULTY_LABELS = {"easy": 0.3, "medium": 0.55, "hard": 0.8}
DEFAULT_DIFFICULTY = 0.5


async def _sync_step_and_answers(
    session: AsyncSession, version: CaseVersion, options: list[dict]
) -> None:
    """Приводит шаг кейса и варианты ответа к состоянию пака.

    Варианты пересобираются только при реальном изменении набора, чтобы не
    плодить лишние delete/insert при каждом перезапуске импорта.
    """
    step = await session.scalar(
        select(CaseStep)
        .where(CaseStep.case_version_id == version.id)
        .order_by(CaseStep.position)
    )
    if step is None:
        step = CaseStep(case_version_id=version.id, position=1, prompt=STEP_PROMPT)
        session.add(step)
        await session.flush()

    wanted = [
        (
            str(o.get("text") or "").strip(),
            bool(o.get("is_correct")),
            o.get("explanation"),
        )
        for o in options
        if isinstance(o, dict) and str(o.get("text") or "").strip()
    ]
    existing = (
        await session.scalars(
            select(CaseAnswer)
            .where(CaseAnswer.step_id == step.id)
            .order_by(CaseAnswer.text)
        )
    ).all()
    if sorted((a.text, a.is_correct, a.explanation) for a in existing) == sorted(
        wanted
    ):
        return

    for answer in existing:
        await session.delete(answer)
    await session.flush()
    for text, is_correct, explanation in wanted:
        session.add(
            CaseAnswer(
                step_id=step.id,
                text=text,
                is_correct=is_correct,
                explanation=explanation,
                error_type=None if is_correct else "wrong_choice",
            )
        )
    await session.flush()


async def _sync_competency_link(
    session: AsyncSession, version: CaseVersion, competency: Competency
) -> None:
    """Привязывает версию кейса к компетенции (вес 1.0), если связи ещё нет."""
    link = await session.scalar(
        select(CaseCompetency).where(
            CaseCompetency.case_version_id == version.id,
            CaseCompetency.competency_id == competency.id,
        )
    )
    if link is None:
        session.add(
            CaseCompetency(
                case_version_id=version.id,
                competency_id=competency.id,
                weight=1.0,
            )
        )
        await session.flush()


async def import_cases(
    session: AsyncSession,
    packs_dir: Path | str | None = None,
    *,
    publish: bool = True,
) -> dict[str, int]:
    """Импортирует кейсы из ``cases.json`` в адаптивный банк (идемпотентно).

    :param packs_dir: каталог с паками; по умолчанию ``app/content_packs``.
    :param publish: помечать ли кейсы ``published``. Юридическую проверку это не
        меняет — ``review_status`` остаётся ``imported``.
    :return: отчёт ``{"created": n, "updated": n}``.
    """
    report = {"created": 0, "updated": 0}
    for index, case in enumerate(read_cases_pack(packs_dir)):
        slug = validate_case(case, index)
        difficulty = difficulty_to_float(case.get("difficulty"))
        learning_case, version, created = await _get_or_create_version(
            session, case, slug, difficulty
        )

        learning_case.title = str(case["title"])[:255]
        if publish:
            learning_case.status = "published"
            version.status = "published"
        version.situation = str(case["case_text"])
        version.difficulty = difficulty

        codex = str(case.get("codex") or "Разное").strip() or "Разное"
        domain = await _get_or_create_domain(session, codex[:128])
        topic = await _get_or_create_topic(session, domain, codex)
        competency = await _get_or_create_competency(
            session, topic, slug[:128], str(case["title"])
        )

        await _sync_step_and_answers(session, version, case.get("options") or [])
        await _sync_competency_link(session, version, competency)

        report["created" if created else "updated"] += 1

    return report


async def set_review_status(
    session: AsyncSession,
    slug: str,
    review_status: str,
    *,
    reviewed_by: str | None = None,
) -> CaseVersion:
    """Меняет статус юридической проверки кейса (``in_review`` / ``approved``).

    Отдельный шаг от импорта: контент может быть загружен, но ещё не проверен
    юристом. ``approved`` фиксирует проверяющего и время проверки.
    """
    if review_status not in REVIEW_STATUSES:
        raise ContentImportError(f"Недопустимый статус проверки: {review_status}")

    version = await session.scalar(
        select(CaseVersion).where(CaseVersion.source_slug == slug)
    )
    if version is None:
        raise ContentImportError(f"Кейс {slug!r} не найден в адаптивном банке")

    version.review_status = review_status
    version.reviewed_by = reviewed_by
    version.reviewed_at = (
        datetime.now(timezone.utc) if review_status == "approved" else None
    )
    await session.flush()
    return version


REVIEW_STATUSES = ("imported", "in_review", "approved")


class ContentImportError(Exception):
    """Ошибка чтения или валидации контент-пака."""
