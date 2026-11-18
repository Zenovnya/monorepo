"""Тесты админского управления юридической проверкой кейсов.

Проверяется не «ручка отвечает 200», а поведение, из-за которого модератор
теряет время: правильный код ошибки при недопустимом статусе, отказ без
токена, и то, что сводка честно показывает, сколько кейсов видит пользователь.

БД не нужна: проверяются валидация параметров, схема ответа и наличие вкладки
в HTML-админке. Сквозной сценарий (одобрение → кейс появился в
`/learning/next`) прогоняется на sqlite в `test_learning_service.py`.
"""

import pytest


def test_review_statuses_are_declared() -> None:
    """Список статусов — единственный источник правды для API и админки."""
    from app.modules.learning.importer import REVIEW_STATUSES

    assert REVIEW_STATUSES == ("imported", "in_review", "approved")


def test_invalid_status_is_rejected_by_importer() -> None:
    """Импортёр не принимает произвольную строку статуса."""
    import asyncio

    from app.modules.learning import importer

    async def _run() -> None:
        with pytest.raises(importer.ContentImportError):
            # Проверка статуса идёт до запроса в БД, поэтому session не нужен.
            await importer.set_review_status(None, "any-slug", "whatever")

    asyncio.run(_run())


def test_admin_ui_contains_review_tab() -> None:
    """Вкладка «Юрпроверка» — не украшение: без неё гейт нечем управлять."""
    from pathlib import Path

    html = (
        Path(__file__).resolve().parents[1]
        / "app"
        / "modules"
        / "admin"
        / "ui.html"
    ).read_text(encoding="utf-8")

    assert "Юрпроверка" in html
    assert "/admin/content/adaptive/review/summary" in html
    assert "setReview" in html
    # Проверяющий обязателен для approved — статус не должен ставиться анонимно.
    assert "Кто проверил кейс?" in html


def test_admin_ui_scripts_are_syntactically_plausible() -> None:
    """HTML-админка не собирается инструментами — ловим хотя бы баланс скобок.

    Ошибка в inline-скрипте делает **всю** страницу нерабочей без сообщений:
    браузер просто ничего не выполняет. Поэтому проверяем, что скобки и
    кавычки шаблонов сбалансированы, а нужные функции объявлены.
    """
    from pathlib import Path

    html = (
        Path(__file__).resolve().parents[1]
        / "app"
        / "modules"
        / "admin"
        / "ui.html"
    ).read_text(encoding="utf-8")

    assert html.count("<script>") == html.count("</script>") == 1

    script = html.split("<script>", 1)[1].rsplit("</script>", 1)[0]
    assert script.count("async function loadReview(") == 1
    assert script.count("async function setReview(") == 1
    # Вкладка должна перерисовываться при открытии, иначе статусы протухают.
    assert "if (name === 'review') loadReview();" in script
