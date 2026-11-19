"""Админка контента: страница и ручки не должны расходиться.

Главный тест здесь — не «ручка ответила 200», а сверка: каждая ручка, которую
зовёт ``ui.html``, обязана существовать в роутере. Раньше это не проверялось,
и страница продолжала звать ``/admin/content/cases``, ``/content/units``,
``/adaptive/review`` и ``/content/reload`` уже после того, как контент стал
файлом и ручки удалили. Снаружи это выглядело как «админка сломалась»: каждое
действие давало 404, а тесты были зелёными, потому что страницу не проверял
никто.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.adaptive.pack import get_pack

pytestmark = pytest.mark.asyncio

_UI_PATH = Path(__file__).resolve().parents[1] / "app" / "modules" / "admin" / "ui.html"
_ADMIN_TOKEN = "test-admin-token-for-admin-ui"


@pytest.fixture()
async def client(monkeypatch):
    """Клиент к приложению с заданным admin-токеном.

    Токен подставляется в тот же объект настроек, который читает
    ``require_admin``, поэтому проверка заголовка остаётся настоящей.
    """
    from app.modules.admin import security

    monkeypatch.setattr(security.settings, "admin_token", _ADMIN_TOKEN, raising=False)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


def _headers() -> dict[str, str]:
    return {"X-Admin-Token": _ADMIN_TOKEN}


def _admin_paths_in_ui() -> list[str]:
    """Пути ``/admin/content/...``, которые страница действительно запрашивает.

    Шаблонные вызовы (``'/admin/content/pack/' + lessonId``) приводятся к
    виду ``/admin/content/pack/{lesson_id}``: сверяем форму пути, а не
    конкретный id.
    """
    html = _UI_PATH.read_text(encoding="utf-8")
    paths = []
    for raw in re.findall(r"api\('(/admin/[^']+)'", html):
        if raw.endswith("/"):
            paths.append(raw + "{param}")
        else:
            paths.append(raw)
    return sorted(set(paths))


async def test_every_path_called_by_ui_exists(client) -> None:
    """Страница не зовёт ручек, которых нет.

    Это и есть регрессия, из-за которой админка отдавала 404: путь на странице
    проверяется запросом, а не наличием похожего объявления в роутере.
    """
    paths = _admin_paths_in_ui()
    assert paths, "в ui.html не найдено ни одного вызова api() — тест бесполезен"

    for path in paths:
        # {param} заменяем на реальный id урока: ручка должна ответить по
        # существу, а не 404 «нет такого пути».
        url = path.replace("{param}", "CIV01")
        response = await client.post(url, headers=_headers()) if "validate" in url \
            else await client.get(url, headers=_headers())
        assert response.status_code not in (404, 405), (
            f"страница зовёт {path}, а ручки нет: {response.status_code} {response.text[:200]}"
        )


async def test_ui_no_longer_calls_removed_endpoints(client) -> None:
    """Удалённые ручки прежнего контента не вернулись на страницу."""
    html = _UI_PATH.read_text(encoding="utf-8")
    removed = [
        "/admin/content/cases",
        "/admin/content/units",
        "/admin/content/lessons",
        "/admin/content/adaptive/review",
        "/admin/content/reload",
    ]
    for path in removed:
        assert path not in html, f"страница снова зовёт удалённую ручку {path}"


async def test_ui_served_without_token(client) -> None:
    """HTML отдаётся без токена: он его и собирает.

    Секретов в странице нет — токен вводит человек. Если закрыть и её, админку
    нельзя будет открыть в принципе.
    """
    response = await client.get("/admin/ui")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "LexBear" in response.text


async def test_pack_summary_matches_pack(client) -> None:
    response = await client.get("/admin/content/pack", headers=_headers())
    assert response.status_code == 200
    body = response.json()
    pack = get_pack()
    assert body["release_key"] == pack.release_key
    assert body["topics"] == len(pack.topics) == 6
    assert body["lessons"] == len(pack.lessons) == 30
    assert body["items"] == len(pack.items) == 90
    assert body["legal_authorities"] == len(pack.authorities) == 72
    # Пометка об отсутствии юрпроверки обязана быть видна в админке.
    assert body["editorial_note"]


async def test_structure_lists_all_lessons_in_order(client) -> None:
    response = await client.get("/admin/content/pack/structure", headers=_headers())
    assert response.status_code == 200
    body = response.json()
    pack = get_pack()

    assert [t["topic_id"] for t in body["topics"]] == ["CIV", "POL", "BUY", "DEBT", "HOME", "WORK"]
    # Все уроки пака учтены ровно по одному разу: ни потерянных, ни дублей.
    listed = [lesson["lesson_id"] for t in body["topics"] for lesson in t["lessons"]]
    assert sorted(listed) == sorted(pack.lessons)
    assert len(listed) == len(set(listed)) == 30

    for topic in body["topics"]:
        orders = [lesson["order"] for lesson in topic["lessons"]]
        assert orders == sorted(orders), f"уроки темы {topic['topic_id']} не по порядку"
        for lesson in topic["lessons"]:
            assert lesson["control_item_id"], "урок без проверочной карточки"


async def test_lesson_preview_is_the_studying_screen(client) -> None:
    response = await client.get("/admin/content/pack/CIV01", headers=_headers())
    assert response.status_code == 200
    body = response.json()
    assert body["lesson_id"] == "CIV01"
    assert body["topic_id"] == "CIV"
    for field in ("title", "goal", "theory", "actions", "control_item_id", "guide_item_id"):
        assert body[field], f"в учебном экране нет поля {field}"


async def test_lesson_preview_unknown_id_is_404(client) -> None:
    response = await client.get("/admin/content/pack/NOPE99", headers=_headers())
    assert response.status_code == 404


async def test_validate_pack_accepts_published_pack(client) -> None:
    response = await client.post("/admin/content/pack/validate", headers=_headers())
    assert response.status_code == 200
    assert response.json()["ok"] is True


async def test_admin_endpoints_require_token(client) -> None:
    """Без токена — 401, а не данные.

    Контент не секретный, но ручки админки не должны быть открыты: иначе
    кто угодно читает внутреннюю структуру и дергает валидацию.
    """
    for path in ("/admin/content/pack", "/admin/content/pack/structure", "/admin/content/status"):
        response = await client.get(path)
        assert response.status_code == 401, f"{path} отдал данные без токена"


async def test_wrong_token_is_rejected(client) -> None:
    response = await client.get(
        "/admin/content/pack", headers={"X-Admin-Token": "not-the-token"}
    )
    assert response.status_code == 401
