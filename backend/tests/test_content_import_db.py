"""DB-тесты импортёра: идемпотентность и статусы юридической проверки.

Требуют ``DATABASE_URL`` (в CI — сервис Postgres, локально — docker compose).
Без доступной БД модуль целиком помечается как skipped, чтобы `pytest` не
падал на машинах без Postgres. Slug в паках уникальны для каждого запуска,
поэтому тесты не конфликтуют между собой и с данными сида.
"""

import json
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from app.database import Base, async_session_factory, engine
from app.modules.learning import importer
from app.modules.learning.models import CaseAnswer, CaseStep, CaseVersion, LearningCase

PACK = {
    "cases": [
        {
            "slug": "return-of-complex-goods",
            "title": "Возврат технически сложного товара",
            "codex": "ЗОЗПП",
            "difficulty": "medium",
            "case_text": "Товар сломался на 20-й день.",
            "options": [
                {"text": "Требовать замену", "is_correct": False, "explanation": "Нет"},
                {
                    "text": "Отказаться от договора",
                    "is_correct": True,
                    "explanation": "Да",
                },
                {"text": "Ничего не делать", "is_correct": False, "explanation": "Нет"},
            ],
        },
        {
            "slug": "police-document-check",
            "title": "Проверка документов",
            "codex": "КоАП",
            "difficulty": "hard",
            "case_text": "Сотрудник просит предъявить документы.",
            "options": [
                {
                    "text": "Уточнить основание",
                    "is_correct": True,
                    "explanation": "Нужно",
                },
                {"text": "Убежать", "is_correct": False, "explanation": "Риск"},
            ],
        },
    ]
}


def _probe_database() -> bool:
    import asyncio

    async def _run() -> bool:
        async with engine.connect() as conn:
            await conn.run_sync(Base.metadata.create_all)
        return True

    try:
        ok = asyncio.run(_run())
    except Exception:  # noqa: BLE001 — любая ошибка подключения = БД недоступна
        return False
    finally:
        # asyncio.run() закрывает свой event loop, но пул engine остаётся
        # привязан к нему: asyncpg-соединения из пула потом падают с
        # "Event loop is closed" и "NoneType has no attribute 'send'",
        # когда тесты запускаются в новом loop (Windows Proactor).
        engine.sync_engine.pool.dispose()
    return ok


if not _probe_database():  # pragma: no cover - зависит от окружения
    pytest.skip(
        "DATABASE_URL недоступен — DB-тесты импортёра пропущены "
        "(поднимите Postgres: infra/docker/docker-compose.yml)",
        allow_module_level=True,
    )


@pytest.fixture()
def packs_dir(tmp_path: Path) -> Path:
    suffix = uuid.uuid4().hex[:8]
    pack = json.loads(json.dumps(PACK))
    for case in pack["cases"]:
        case["slug"] = f"{case['slug']}-{suffix}"
    (tmp_path / "cases.json").write_text(
        json.dumps(pack, ensure_ascii=False), encoding="utf-8"
    )
    return tmp_path


def _slugs(packs_dir: Path) -> list[str]:
    raw = json.loads((packs_dir / "cases.json").read_text(encoding="utf-8"))
    return [case["slug"] for case in raw["cases"]]


async def _import(packs_dir: Path, **kwargs) -> dict:
    async with async_session_factory() as session:
        report = await importer.import_cases(session, packs_dir, **kwargs)
        await session.commit()
    return report


async def test_import_creates_full_adaptive_bank(packs_dir: Path) -> None:
    report = await _import(packs_dir)
    assert report == {"created": 2, "updated": 0}

    async with async_session_factory() as session:
        versions = (
            await session.scalars(
                select(CaseVersion).where(
                    CaseVersion.source_slug.in_(_slugs(packs_dir))
                )
            )
        ).all()
        steps = (
            await session.scalars(
                select(CaseStep).where(
                    CaseStep.case_version_id.in_([v.id for v in versions])
                )
            )
        ).all()
        answers = (
            await session.scalars(
                select(CaseAnswer).where(CaseAnswer.step_id.in_([s.id for s in steps]))
            )
        ).all()
        case = await session.get(LearningCase, versions[0].case_id)

    assert len(versions) == 2
    assert len(steps) == 2
    assert len(answers) == 5
    assert case.status == "published"
    assert all(v.status == "published" for v in versions)
    # Импорт публикует кейсы, но НЕ означает юридическую проверку.
    assert all(v.review_status == "imported" for v in versions)
    assert all(v.reviewed_by is None and v.reviewed_at is None for v in versions)


async def test_reimport_is_idempotent(packs_dir: Path) -> None:
    await _import(packs_dir)
    report = await _import(packs_dir)
    assert report == {"created": 0, "updated": 2}

    async with async_session_factory() as session:
        versions = (
            await session.scalars(
                select(CaseVersion).where(
                    CaseVersion.source_slug.in_(_slugs(packs_dir))
                )
            )
        ).all()
        steps = (
            await session.scalars(
                select(CaseStep).where(
                    CaseStep.case_version_id.in_([v.id for v in versions])
                )
            )
        ).all()
        answers = (
            await session.scalars(
                select(CaseAnswer).where(CaseAnswer.step_id.in_([s.id for s in steps]))
            )
        ).all()

    assert len(versions) == 2
    assert len(steps) == 2
    assert len(answers) == 5


async def test_import_updates_changed_case_in_place(packs_dir: Path) -> None:
    await _import(packs_dir)
    slug = _slugs(packs_dir)[0]

    changed = json.loads((packs_dir / "cases.json").read_text(encoding="utf-8"))
    changed["cases"][0]["title"] = "Обновлённый заголовок"
    changed["cases"][0]["options"][1]["text"] = "Вернуть деньги по ст. 18"
    (packs_dir / "cases.json").write_text(
        json.dumps(changed, ensure_ascii=False), encoding="utf-8"
    )
    await _import(packs_dir)

    async with async_session_factory() as session:
        version = await session.scalar(
            select(CaseVersion).where(CaseVersion.source_slug == slug)
        )
        case = await session.get(LearningCase, version.case_id)
        step = await session.scalar(
            select(CaseStep).where(CaseStep.case_version_id == version.id)
        )
        answers = (
            await session.scalars(
                select(CaseAnswer).where(CaseAnswer.step_id == step.id)
            )
        ).all()

    texts = [a.text for a in answers]
    assert case.title == "Обновлённый заголовок"
    assert "Вернуть деньги по ст. 18" in texts
    assert len(texts) == 3


async def test_review_status_flow(packs_dir: Path) -> None:
    await _import(packs_dir)
    slug = _slugs(packs_dir)[1]

    async with async_session_factory() as session:
        await importer.set_review_status(
            session, slug, "approved", reviewed_by="юрист-1"
        )
        await session.commit()
        version = await session.scalar(
            select(CaseVersion).where(CaseVersion.source_slug == slug)
        )

    assert version.review_status == "approved"
    assert version.reviewed_by == "юрист-1"
    assert version.reviewed_at is not None


async def test_review_status_rejects_unknown_value(packs_dir: Path) -> None:
    await _import(packs_dir)
    slug = _slugs(packs_dir)[0]
    async with async_session_factory() as session:
        with pytest.raises(importer.ContentImportError, match="Недопустимый статус"):
            await importer.set_review_status(session, slug, "nonsense")


async def test_review_status_for_unknown_case_fails() -> None:
    async with async_session_factory() as session:
        with pytest.raises(importer.ContentImportError, match="не найден"):
            await importer.set_review_status(session, "no-such-case", "approved")


class TestLegacyCaseListRespectsReviewGate:
    """Вкладка «Кейсы» читает legacy-таблицу, но обязана уважать гейт.

    Дефект: гейт стоял только в адаптивном банке. `/learning/next` непроверенный
    кейс не отдавал, а `GET /lexbear/cases` показывал его в списке вместе со
    всеми вариантами ответов — то есть пользователь всё равно учился по тексту,
    который юрист не смотрел. Проверено на живом сервере: 4 одобренных кейса в
    банке и 100 в списке.
    """

    @staticmethod
    def _legacy_case(slug: str) -> "object":
        from app.modules.content.models import Case

        return Case(
            slug=slug,
            title=f"Кейс {slug}",
            codex="КоАП",
            difficulty="medium",
            case_text="Ситуация",
            situation="Ситуация",
        )

    async def test_unreviewed_case_is_hidden_from_list(self) -> None:
        from app.database import async_session_factory
        from app.modules.content import lexbear_service
        from app.modules.content.models import Case
        from app.modules.learning import importer
        from app.modules.learning.models import CaseVersion, LearningCase
        from sqlalchemy import select

        suffix = uuid.uuid4().hex[:8]
        approved_slug = f"gate-approved-{suffix}"
        imported_slug = f"gate-imported-{suffix}"

        async with async_session_factory() as session:
            for slug in (approved_slug, imported_slug):
                session.add(self._legacy_case(slug))
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
                        review_status="imported",
                        source_slug=slug,
                    )
                )
            await session.commit()

        async with async_session_factory() as session:
            await importer.set_review_status(session, approved_slug, "approved", reviewed_by="test")
            await session.commit()

        async with async_session_factory() as session:
            reviewed = await lexbear_service.reviewed_case_slugs(
                session, [approved_slug, imported_slug]
            )
            assert reviewed == {approved_slug}

            listed = await lexbear_service.list_cases(session)
            slugs = {item["title"] for item in listed}
            assert f"Кейс {approved_slug}" in slugs
            assert f"Кейс {imported_slug}" not in slugs, (
                "непроверенный кейс не должен попадать в список вкладки «Кейсы»"
            )

            # Прямой переход по id тоже не должен открывать скрытый кейс.
            hidden = await session.scalar(select(Case).where(Case.slug == imported_slug))
            with pytest.raises(lexbear_service.CaseNotFoundError):
                await lexbear_service.get_case(session, hidden.id)


class TestProgressRespectsReviewGate:
    """Ответ и повторения не должны обходить юрпроверку.

    Проверено на живом сервере до правки: `POST /progress/answer` по id
    непроверенного кейса отдавал `200`, правильный ответ, разбор со ссылкой на
    норму и записывал SRS-состояние. То есть весь гейт обходился одной ручкой,
    которая читает legacy-таблицу `cases`.
    """

    async def test_hidden_case_cannot_be_answered(self) -> None:
        from app.database import async_session_factory
        from app.modules.content.models import Case, CaseOption
        from app.modules.learning.models import CaseVersion, LearningCase
        from app.modules.progress import service as progress_service

        suffix = uuid.uuid4().hex[:8]
        slug = f"progress-hidden-{suffix}"

        async with async_session_factory() as session:
            case = Case(
                slug=slug,
                title="Скрытый кейс",
                codex="КоАП",
                difficulty="medium",
                case_text="Ситуация",
                situation="Ситуация",
            )
            session.add(case)
            await session.flush()
            session.add(
                CaseOption(
                    case_id=case.id, text="Верно", is_correct=True, explanation="Разбор"
                )
            )
            bank = LearningCase(title=slug, status="published")
            session.add(bank)
            await session.flush()
            session.add(
                CaseVersion(
                    case_id=bank.id,
                    version=1,
                    situation=slug,
                    difficulty=0.5,
                    status="published",
                    review_status="imported",
                    source_slug=slug,
                )
            )
            await session.commit()
            case_id = case.id

        async with async_session_factory() as session:
            option = await session.scalar(
                select(CaseOption.id).where(CaseOption.case_id == case_id)
            )
            with pytest.raises(progress_service.CaseNotFoundError):
                await progress_service.answer_case(
                    session, uuid.uuid4(), case_id, option
                )

    async def test_option_from_another_case_is_rejected(self) -> None:
        """Чужой вариант раньше давал `correct: true` и SRS-прогресс."""
        from app.database import async_session_factory
        from app.modules.content.models import Case, CaseOption
        from app.modules.content.review_gate import reviewed_case_slugs
        from app.modules.learning import importer
        from app.modules.learning.models import CaseVersion, LearningCase
        from app.modules.progress import service as progress_service

        suffix = uuid.uuid4().hex[:8]
        slug_a = f"progress-a-{suffix}"
        slug_b = f"progress-b-{suffix}"

        async with async_session_factory() as session:
            ids = {}
            for slug in (slug_a, slug_b):
                case = Case(
                    slug=slug,
                    title=slug,
                    codex="КоАП",
                    difficulty="medium",
                    case_text="Ситуация",
                    situation="Ситуация",
                )
                session.add(case)
                await session.flush()
                ids[slug] = case.id
                session.add(
                    CaseOption(
                        case_id=case.id, text="Верно", is_correct=True, explanation="Разбор"
                    )
                )
                bank = LearningCase(title=slug, status="published")
                session.add(bank)
                await session.flush()
                session.add(
                    CaseVersion(
                        case_id=bank.id,
                        version=1,
                        situation=slug,
                        difficulty=0.5,
                        status="published",
                        review_status="imported",
                        source_slug=slug,
                    )
                )
            await session.commit()

        async with async_session_factory() as session:
            for slug in (slug_a, slug_b):
                await importer.set_review_status(session, slug, "approved", reviewed_by="test")
            await session.commit()

        async with async_session_factory() as session:
            assert await reviewed_case_slugs(session, [slug_a, slug_b]) == {slug_a, slug_b}
            foreign_option = await session.scalar(
                select(CaseOption.id).where(CaseOption.case_id == ids[slug_b])
            )
            with pytest.raises(progress_service.OptionNotFoundError):
                await progress_service.answer_case(
                    session, uuid.uuid4(), ids[slug_a], foreign_option
                )


class TestSoftDeleteRetiresAdaptiveVersions:
    """Мягкое удаление в админке должно действовать и на адаптивную ленту.

    Проверено на живом сервере до правки: `DELETE /admin/content/cases/{slug}`
    убирал кейс из вкладки «Кейсы», но `/learning/next` продолжал его отдавать
    — решение «больше не показываем» действовало только на одном из двух
    путей. Причина: адаптивный банк хранит свою копию версии и о флаге
    `cases.is_active` не знает.
    """

    async def test_retire_hides_version_from_bank(self) -> None:
        from app.database import async_session_factory
        from app.modules.content import review_gate
        from app.modules.content.models import Case
        from app.modules.learning import importer
        from app.modules.learning.models import CaseVersion, LearningCase
        from sqlalchemy import select

        suffix = uuid.uuid4().hex[:8]
        slug = f"retire-{suffix}"

        async with async_session_factory() as session:
            session.add(
                Case(
                    slug=slug,
                    title=slug,
                    codex="КоАП",
                    difficulty="medium",
                    case_text="Ситуация",
                    situation="Ситуация",
                )
            )
            bank = LearningCase(title=slug, status="published")
            session.add(bank)
            await session.flush()
            session.add(
                CaseVersion(
                    case_id=bank.id,
                    version=1,
                    situation=slug,
                    difficulty=0.5,
                    status="published",
                    review_status="imported",
                    source_slug=slug,
                )
            )
            await session.commit()

        async with async_session_factory() as session:
            await importer.set_review_status(session, slug, "approved", reviewed_by="test")
            await session.commit()

        async with async_session_factory() as session:
            assert await review_gate.reviewed_case_slugs(session, [slug]) == {slug}

            retired = await review_gate.retire_legacy_case(session, slug)
            await session.commit()
            assert retired == 1

        async with async_session_factory() as session:
            version = await session.scalar(
                select(CaseVersion).where(CaseVersion.source_slug == slug)
            )
            assert version.status == "retired"
            assert await review_gate.reviewed_case_slugs(session, [slug]) == set()
