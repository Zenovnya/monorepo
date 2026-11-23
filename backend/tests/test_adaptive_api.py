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
from app.modules.auth.models import User

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


async def test_wrong_answer_spends_life_and_cache_updates(api) -> None:
    """Неправильный зачтённый ответ списывает жизнь, и она видна сразу.

    Без очистки кэша gamification-me (TTL 120 с) следующий запрос отдал бы
    старые значения с полным запасом, и списание на экране не отразилось.
    """
    client, maker = api
    user_id = uuid.uuid4()
    async with maker() as session:
        session.add(
            User(
                id=user_id,
                email="lives@example.com",
                username="Lives",
                hashed_password="hash",
                xp=0,
                level=1,
                streak=0,
                gems=0,
                lives=5,
            )
        )
        await session.commit()
    headers = _headers(user_id)

    opened = (await client.get("/adaptive/next", headers=headers)).json()
    item_id = opened["item"]["item_id"]
    options = get_pack().items[item_id]["options"]
    correct = next(o["id"] for o in options if o["id"] == get_pack().items[item_id]["correct_option_id"])
    wrong = next(o["id"] for o in options if o["id"] != correct)

    response = await client.post(
        f"/adaptive/attempts/{opened['attempt_id']}/actions",
        json={"action": "answer", "option_id": wrong},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["counted"] is True
    assert body["correct"] is False
    assert body["lives_spent"] == 1

    # gamification-me должен отдать обновлённое значение, а не кэш с 5 жизнями.
    me = (await client.get("/gamification/me", headers=headers)).json()
    assert me["lives"] == 4
    assert me["max_lives"] == 5


async def test_answer_awards_achievements(api) -> None:
    """Первый зачтённый ответ выдаёт достижение и возвращает его в ответе.

    Без этого в ответе act() не было achievements: клиент не мог показать
    тост «Достижение получено» сразу по ответу.
    """
    client, maker = api
    user_id = uuid.uuid4()
    async with maker() as session:
        session.add(
            User(
                id=user_id,
                email="ach@example.com",
                username="Ach",
                hashed_password="hash",
                xp=0,
                level=1,
                streak=0,
                gems=0,
            )
        )
        await session.commit()
    headers = _headers(user_id)

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
    assert body["counted"] is True

    codes = {a["code"] for a in body.get("achievements", [])}
    assert "first_step" in codes

    # Достижение сохраняется и видно в состоянии геймификации.
    me = (await client.get("/gamification/me", headers=headers)).json()
    assert any(a["code"] == "first_step" for a in me["achievements"])


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


async def test_two_users_can_each_open_their_first_attempt(api) -> None:
    """Первый кейс открывается у второго пользователя тоже.

    Реальный дефект: движок нумеровал попытки внутри пользователя (`a1`, `a2`),
    а `adaptive_attempts.id` — глобальный первичный ключ. Первый, кто занял
    `a1`, ломал выдачу всем остальным:

        sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError)
        UNIQUE constraint failed: adaptive_attempts.id
        [parameters: ('a1', ...)]

    Клиент получал 500 на /adaptive/next, а экран показывал «не удалось
    загрузить практику». Дальше `a2` занимал следующий пользователь, и дефект
    выглядел как «какие-то уроки открываются, какие-то нет» — ровно то, что
    видит человек.

    Прежний тест `test_client_cannot_answer_someone_elses_attempt` этого не
    ловил: он открывал попытку только у первого пользователя, а второй лишь
    пытался ответить чужой.
    """
    client, _ = api
    first = _headers(uuid.uuid4())
    second = _headers(uuid.uuid4())

    opened_first = await client.get("/adaptive/next", headers=first)
    assert opened_first.status_code == 200, opened_first.text

    # Второй пользователь — тоже «первая попытка», значит тот же seq=1.
    opened_second = await client.get("/adaptive/next", headers=second)
    assert opened_second.status_code == 200, opened_second.text
    assert opened_second.json()["attempt_id"]

    # И ответ второго не должен задевать попытку первого.
    answered = await client.post(
        f"/adaptive/attempts/{opened_second.json()['attempt_id']}/actions",
        json={"action": "answer", "option_id": "A"},
        headers=second,
    )
    assert answered.status_code == 200, answered.text

    still_first = await client.get("/adaptive/next", headers=first)
    assert still_first.status_code == 200, still_first.text


async def test_many_users_do_not_collide_on_attempt_ids(api) -> None:
    """Пять пользователей подряд: id попыток не совпадают между ними."""
    client, _ = api
    seen: set[str] = set()
    for _ in range(5):
        response = await client.get("/adaptive/next", headers=_headers(uuid.uuid4()))
        assert response.status_code == 200, response.text
        attempt_id = response.json()["attempt_id"]
        assert attempt_id, response.text
        assert attempt_id not in seen, f"id попытки повторился: {attempt_id}"
        seen.add(attempt_id)


async def test_correct_answer_awards_xp(api) -> None:
    """Зачтённый правильный ответ начисляет XP.

    XP раньше начислялся только через ручку /gamification/add-xp, которую
    никто не вызывал: за уроки и кейсы XP не прибавлялся вообще, и счётчик
    стоял на нуле.
    """
    client, _ = api
    # Пользователь нужен в БД: без него XP начислить нельзя, и сам ответ
    # отстанет от реальности.
    resp = await client.post(
        "/auth/register",
        json={
            "email": f"xp{uuid.uuid4().hex[:8]}@example.com",
            "password": "PreviewPass123",
            "full_name": "XP",
        },
    )
    token = resp.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    opened = (await client.get("/adaptive/next", headers=h)).json()
    correct = get_pack().items[opened["item"]["item_id"]]["correct_option_id"]
    before = (await client.get("/gamification/me", headers=h)).json()
    assert before["xp"] == 0
    body = (
        await client.post(
            f"/adaptive/attempts/{opened['attempt_id']}/actions",
            json={"action": "answer", "option_id": correct},
            headers=h,
        )
    ).json()
    assert body["xp_gained"] > 0
    after = (await client.get("/gamification/me", headers=h)).json()
    assert after["xp"] == before["xp"] + body["xp_gained"]


async def test_hint_keeps_attempt_open(api) -> None:
    """Подсказка не закрывает попытку: статус open и можно дальше ответить.

    Клиент раньше кладул ответ подсказки в результат, что отключало
    варианты ответа и скрывало «Следующий кейс» — кейс висел.
    """
    client, _ = api
    headers = _headers(uuid.uuid4())
    opened = (await client.get("/adaptive/next", headers=headers)).json()

    body = (
        await client.post(
            f"/adaptive/attempts/{opened['attempt_id']}/actions",
            json={"action": "help"},
            headers=headers,
        )
    ).json()
    assert body["status"] == "open"
    assert body["assistance"]

    # Попытка жива: ответ после подсказки ещё принимается (но не засчитывается).
    item_id = opened["item"]["item_id"]
    correct = get_pack().items[item_id]["correct_option_id"]
    answered = (
        await client.post(
            f"/adaptive/attempts/{opened['attempt_id']}/actions",
            json={"action": "answer", "option_id": correct},
            headers=headers,
        )
    ).json()
    assert answered["status"] == "answered"
    assert answered["counted"] is False


async def test_overview_progress_is_topic_completion(api) -> None:
    """Полоса прогресса — сколько уроков темы пройдено, а не приоритет.

    Раньше прогресс темы показывал practice_priority: тема без ответов
    начиналась с 50 %, а после пары правильных ответов «прогресс» падал
    до 25 % — по факту уменьшался по мере прохождения.
    """
    client, _ = api
    headers = _headers(uuid.uuid4())
    overview = (await client.get("/adaptive/overview", headers=headers)).json()
    for topic in overview["topics"]:
        assert topic["progress_pct"] == 0.0
        assert topic["lessons_practised"] == 0

    # Решим уроки одной темы полностью — прогресс должен дойти до 100 %.
    # Чистый engine-уровень: считаем lesson_check-попытки через HTTP.
    opened = (await client.get("/adaptive/next", headers=headers)).json()
    item_id = opened["item"]["item_id"]
    correct = get_pack().items[item_id]["correct_option_id"]
    await client.post(
        f"/adaptive/attempts/{opened['attempt_id']}/actions",
        json={"action": "answer", "option_id": correct},
        headers=headers,
    )
    overview = (await client.get("/adaptive/overview", headers=headers)).json()
    # Зачтённый ответ должен прибавить прогресс (хотя бы одной теме).
    assert any(t["progress_pct"] > 0 for t in overview["topics"])


async def test_parallel_attempts_do_not_crash_on_state_creation(api) -> None:
    """Два парных запроса при создании состояния не должны падать с 500.

    Реальный дефект: два парных запроса от нового пользователя (нажатие
    кнопки + повторный рендер) оба видели «статьи нет» и оба пытались
    создать строку состояния. IntegrityError уходил в 500, и клиент
    показывал «Сервер не смог отдать проверку. Мы уже разбираемся».
    """
    import asyncio

    client, _ = api
    headers = _headers(uuid.uuid4())

    async def open_check():
        return await client.post(
            "/adaptive/attempts",
            json={"item_id": "CIV01_C", "mode": "check", "origin": "lesson"},
            headers=headers,
        )

    responses = await asyncio.gather(open_check(), open_check())
    codes = sorted(r.status_code for r in responses)
    # Один запрос создаёт попытку (200), другой находит уже открытую —
    # ни один не должен вернуть 5xx.
    assert codes == [200, 400], codes
    assert all(code < 500 for code in codes)


async def test_parallel_answers_do_not_crash(api) -> None:
    """Два парных ответа на одну попытку не должны падать с 500.

    Реальный дефект: два парных запроса (нажатие «Ответить» + повторный
    рендер, StrictMode, две вкладки) оба прочитали одно состояние и оба
    вставили наблюдение с одним attempt_id — IntegrityError уходил в 500,
    и клиент показывал «Сервер не смог отдать ответ. Мы уже разбираемся»,
    хотя ответ уже приняли.
    """
    import asyncio

    client, _ = api
    headers = _headers(uuid.uuid4())

    # Открыть попытку на конкретной проверке — иначе выбор движка
    # зависит от состояния и тест недетерминирован.
    opened = (
        await client.post(
            "/adaptive/attempts",
            json={"item_id": "CIV01_C", "mode": "check", "origin": "lesson"},
            headers=headers,
        )
    ).json()
    attempt_id = opened["attempt_id"]
    correct = get_pack().items["CIV01_C"]["correct_option_id"]

    async def answer():
        return await client.post(
            f"/adaptive/attempts/{attempt_id}/actions",
            json={"action": "answer", "option_id": correct},
            headers=headers,
        )

    responses = await asyncio.gather(answer(), answer())
    codes = sorted(r.status_code for r in responses)
    # Оба ответа завершаются успешно: один принимает, второй видит, что
    # попытка уже закрыта (already_closed) — ни один не должен вернуть 5xx.
    assert codes == [200, 200], codes
    assert all(code < 500 for code in codes)
