"""Ручки адаптивного обучения: контракт и защита от клиентских подлогов.

Тесты идут через HTTP и sqlite: проверяется не только «ручка ответила 200», но
и то, что клиент не может выдать себе засчитанную попытку, увидеть ключ до
ответа или открыть чужую попытку.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_session
from app.main import app
from app.modules.adaptive import engine
from app.modules.adaptive.pack import get_pack
from app.modules.auth import service as auth_service

pytestmark = pytest.mark.asyncio


@pytest.fixture()
async def api(tmp_path):
    """Приложение на отдельной sqlite-базе с настоящими таблицами."""
    engine_ = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'adaptive.db'}")
    async with engine_.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine_, expire_on_commit=False)

    async def _session():
        async with maker() as session:
            yield session

    app.dependency_overrides[get_session] = _session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, maker
    app.dependency_overrides.pop(get_session, None)
    await engine_.dispose()


def _headers(user_id: uuid.UUID) -> dict[str, str]:
    token = auth_service._create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


async def test_metadata_lists_six_topics(api) -> None:
    client, _ = api
    response = await client.get("/adaptive", headers=_headers(uuid.uuid4()))
    assert response.status_code == 200
    body = response.json()
    assert len(body["topics"]) == 6
    assert [topic["topic_id"] for topic in body["topics"]] == [
        "CIV", "POL", "BUY", "DEBT", "HOME", "WORK"
    ]
    # Пометка о редакционном статусе обязана доехать до клиента: пак
    # опубликован решением владельца, а не по итогам юридической проверки.
    assert body["editorial_note"]


async def test_next_opens_attempt_and_hides_answer(api) -> None:
    client, _ = api
    headers = _headers(uuid.uuid4())
    response = await client.get("/adaptive/next", headers=headers)
    assert response.status_code == 200
    body = response.json()

    assert body["choice"]["kind"] == "new_case"
    assert body["attempt_id"] and body["mode"] == "fresh_case"
    item = body["item"]
    assert item["item_id"] == body["choice"]["item_id"]
    # Ключ и разбор до ответа не отдаются — иначе ответ читается из API.
    serialized = str(body)
    for leaked in ("correct_option_id", "provenance", "source_trace", "explanation"):
        assert leaked not in serialized


async def test_second_next_resumes_same_attempt(api) -> None:
    client, _ = api
    headers = _headers(uuid.uuid4())
    first = (await client.get("/adaptive/next", headers=headers)).json()
    second = (await client.get("/adaptive/next", headers=headers)).json()
    assert second["choice"]["kind"] == "resume"
    assert second["attempt_id"] == first["attempt_id"]


async def test_answer_reveals_explanation_and_counts(api) -> None:
    client, _ = api
    headers = _headers(uuid.uuid4())
    opened = (await client.get("/adaptive/next", headers=headers)).json()
    item_id = opened["item"]["item_id"]
    correct = get_pack().items[item_id]["correct_option_id"]

    response = await client.post(
        f"/adaptive/attempts/{opened['attempt_id']}/actions",
        json={"action": "answer", "option_id": correct},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["correct"] is True
    assert body["counted"] is True
    assert body["correct_option_id"] == correct
    assert body["explanation"]

    overview = (await client.get("/adaptive/overview", headers=headers)).json()
    topic = next(row for row in overview["topics"] if row["topic_id"] == "CIV")
    assert topic["n"] == 1
    assert topic["correct_count"] == 1
    assert topic["lessons_practised"] >= 0


async def test_help_blocks_counting(api) -> None:
    client, _ = api
    headers = _headers(uuid.uuid4())
    opened = (await client.get("/adaptive/next", headers=headers)).json()
    item_id = opened["item"]["item_id"]
    attempt_id = opened["attempt_id"]

    help_response = await client.post(
        f"/adaptive/attempts/{attempt_id}/actions",
        json={"action": "help"},
        headers=headers,
    )
    assert help_response.status_code == 200
    assert help_response.json()["status"] == "open"
    assert help_response.json()["assistance"]

    answered = await client.post(
        f"/adaptive/attempts/{attempt_id}/actions",
        json={"action": "answer", "option_id": get_pack().items[item_id]["correct_option_id"]},
        headers=headers,
    )
    assert answered.json()["counted"] is False
    assert answered.json()["reason"] == "ASSISTED"


async def test_client_cannot_self_assign_auto_origin(api) -> None:
    """Иначе клиент накрутил бы себе автоматическую выдачу и зачёт."""
    client, _ = api
    headers = _headers(uuid.uuid4())
    response = await client.post(
        "/adaptive/attempts",
        json={"item_id": "CIV02_R1", "mode": "fresh_case", "origin": "auto"},
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "BAD_ORIGIN"


async def test_client_cannot_answer_someone_elses_attempt(api) -> None:
    client, _ = api
    owner = _headers(uuid.uuid4())
    stranger = _headers(uuid.uuid4())
    opened = (await client.get("/adaptive/next", headers=owner)).json()

    response = await client.post(
        f"/adaptive/attempts/{opened['attempt_id']}/actions",
        json={"action": "answer", "option_id": "A"},
        headers=stranger,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "UNKNOWN_ATTEMPT"


async def test_unknown_lesson_is_404(api) -> None:
    client, _ = api
    response = await client.get("/adaptive/lessons/NOPE99", headers=_headers(uuid.uuid4()))
    assert response.status_code == 404


async def test_lesson_returns_theory(api) -> None:
    client, _ = api
    response = await client.get("/adaptive/lessons/CIV01", headers=_headers(uuid.uuid4()))
    assert response.status_code == 200
    body = response.json()
    assert body["theory"] and body["actions"]
    assert body["control_item_id"] == "CIV01_C"


async def test_requires_authentication(api) -> None:
    client, _ = api
    assert (await client.get("/adaptive/next")).status_code in (401, 403)


async def test_progress_survives_and_advances(api) -> None:
    """Состояние в БД: после ответа следующая выдача идёт по другой карточке."""
    client, _ = api
    headers = _headers(uuid.uuid4())
    first = (await client.get("/adaptive/next", headers=headers)).json()
    item = get_pack().items[first["item"]["item_id"]]
    await client.post(
        f"/adaptive/attempts/{first['attempt_id']}/actions",
        json={"action": "answer", "option_id": item["correct_option_id"]},
        headers=headers,
    )
    second = (await client.get("/adaptive/next", headers=headers)).json()
    assert second["choice"]["kind"] == "new_case"
    assert second["item"]["item_id"] != first["item"]["item_id"]

    overview = (await client.get("/adaptive/overview", headers=headers)).json()
    assert overview["recent"], "наблюдение должно попасть в историю"
    assert overview["recent"][0]["correct"] is True


async def test_review_after_all_fresh_cases_used(api) -> None:
    """Когда свежие кейсы темы кончились, сервер предлагает повтор без зачёта."""
    client, _ = api
    headers = _headers(uuid.uuid4())
    pack = get_pack()
    fresh = [i for i in pack.items if i.startswith("CIV") and i.endswith("_R1")]

    for _ in fresh:
        opened = (
            await client.get("/adaptive/next", headers=headers, params={"topic_id": "CIV"})
        ).json()
        assert opened["choice"]["kind"] == "new_case"
        await client.post(
            f"/adaptive/attempts/{opened['attempt_id']}/actions",
            json={"action": "skip"},
            headers=headers,
        )

    exhausted = (
        await client.get("/adaptive/next", headers=headers, params={"topic_id": "CIV"})
    ).json()
    assert exhausted["choice"]["kind"] == "review"
    assert exhausted["choice"]["reason"] == "FRESH_EXHAUSTED"
    # Повтор не открывает попытку сам: иначе «показать ещё» списывало бы
    # единственную открытую попытку.
    assert exhausted.get("attempt_id") is None
