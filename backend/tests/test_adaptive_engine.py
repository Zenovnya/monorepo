"""Проверки отбора кейсов: наш движок против эталона спецификации.

Тест намеренно состоит из двух частей:

1. **Сценарии из спецификации** — по одному осмысленному случаю на правило
   (ротация, окно наблюдений, зачёт, карантин). Их читают, когда меняют логику.
2. **Дифференциальная сверка** — те же случайные последовательности прогоняются
   через наш ``engine`` и через эталонную реализацию из спецификации. Если
   поведение разойдётся, тест упадёт с номером сценария и шагом.

Вторая часть важнее: правила отбора определяют, на чём учится человек, и
«почти такое же» поведение здесь означает другой кейс на экране.
"""

from __future__ import annotations

import copy
import importlib.util
import json
import random
from fractions import Fraction
from pathlib import Path

import pytest

from app.modules.adaptive import constants as c
from app.modules.adaptive import engine
from app.modules.adaptive.errors import EngineError
from app.modules.adaptive.pack import Pack, load_pack, validate

RELEASE = Path(__file__).resolve().parent / "fixtures" / "theme_engine_reference.py"


def _reference_module():
    """Загружает эталон как модуль (он лежит в тестах, а не в приложении)."""
    spec = importlib.util.spec_from_file_location("theme_engine_reference", RELEASE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


@pytest.fixture(scope="module")
def pack() -> Pack:
    return load_pack()


@pytest.fixture(scope="module")
def draft_pack(tmp_path_factory) -> dict:
    """Копия контента со статусом ``pending_expert_review``.

    Эталон из спецификации рассчитан на черновой пак: его собственный
    ``self_test`` падает на опубликованном (``PUBLISH_GATE``). Для сверки
    поведения нужен одинаковый вход, поэтому статус в копии понижается.
    """
    raw = json.loads(json.dumps(load_pack().raw))
    for row in list(raw["lessons"].values()) + list(raw["items"].values()):
        row["legal_review_status"] = "pending_expert_review"
    return raw


@pytest.fixture(scope="module")
def reference():
    return _reference_module()


# --- Контент и правила импорта --------------------------------------------


def test_pack_matches_reference_self_test(draft_pack, reference) -> None:
    """Эталон принимает присланный контент без замечаний (кроме статуса)."""
    reference.self_test(draft_pack)


def test_our_validator_accepts_shipped_pack(pack) -> None:
    validate(pack)


def test_pack_shape(pack) -> None:
    assert len(pack.topics) == 6
    assert len(pack.lessons) == 30
    assert len(pack.items) == 90
    orders = sorted(topic["order"] for topic in pack.topics.values())
    assert orders == [1, 2, 3, 4, 5, 6]


def test_every_lesson_has_five_ordered_lessons_per_topic(pack) -> None:
    for topic_id in pack.topics:
        orders = sorted(
            lesson["order"]
            for lesson in pack.lessons.values()
            if lesson["primary_topic_id"] == topic_id
        )
        assert orders == [1, 2, 3, 4, 5], topic_id


@pytest.mark.parametrize(
    "mutation, code",
    [
        (lambda raw: raw["items"]["CIV01_C"].update(correct_option_id="Z"), "ANSWER_KEY"),
        (lambda raw: raw["items"]["CIV01_C"]["options"].pop(), "OPTIONS"),
        (lambda raw: raw["lessons"]["CIV01"].update(control_id="POL01_C"), "PAIR"),
        (lambda raw: raw["items"]["CIV02_R1"].update(hint="подсказка"), "CHECK_HINT_LEAK"),
        (lambda raw: raw["items"]["CIV01_C"].update(legal_basis_ids=["НЕТ_ТАКОЙ"]), "LEGAL_BASIS"),
        (lambda raw: raw["lessons"]["CIV01"].update(expert_signoff_id=None), "MISSING_SIGNOFF"),
    ],
)
def test_validator_rejects_broken_content(pack, mutation, code) -> None:
    """Битый пак падает на импорте, а не превращается в нерешаемый вопрос."""
    raw = json.loads(json.dumps(pack.raw))
    mutation(raw)
    with pytest.raises(EngineError) as exc:
        validate(Pack(raw))
    assert str(exc.value) == code


# --- Выбор кейса -----------------------------------------------------------


def test_first_choice_is_deterministic_and_starts_с_первой_темы(pack) -> None:
    """Пустой профиль: все темы равны, побеждает порядок — CIV01."""
    first = engine.choose(pack, engine.State())
    second = engine.choose(pack, engine.State())
    assert first.as_dict() == second.as_dict()
    assert first.kind == c.CHOICE_NEW_CASE
    assert first.topic_id == "CIV"
    assert first.item_id == "CIV01_R1"
    assert first.origin == c.ORIGIN_AUTO
    assert first.reason == c.REASON_THEME_PRIORITY


def _answer(pack, state, item_id, *, correct=True, mode=c.MODE_CHECK, origin=c.ORIGIN_LESSON):
    attempt = engine.issue(pack, state, item_id, mode=mode, origin=origin)
    option = next(
        option["id"] for option in pack.items[item_id]["options"]
        if (option["id"] == pack.items[item_id]["correct_option_id"]) == correct
    )
    return engine.act(pack, state, attempt.id, "answer", option)


def test_auto_flow_marks_attempt_counted(pack) -> None:
    state = engine.State()
    choice = engine.choose(pack, state)
    attempt = engine.issue(pack, state, choice.item_id, mode=c.MODE_FRESH_CASE, origin=c.ORIGIN_AUTO)
    correct = pack.items[choice.item_id]["correct_option_id"]
    result = engine.act(pack, state, attempt.id, "answer", correct)

    assert result["counted"] is True
    assert result["reason"] == c.REASON_COUNTED
    assert result["correct"] is True
    assert "already_closed" not in result
    assert engine.metrics(pack, state)["CIV"].n == 1


def test_metrics_use_window_of_five(pack) -> None:
    state = engine.State()
    lesson_ids = [f"CIV{index:02d}_C" for index in range(1, 6)]
    for index, lesson_id in enumerate(lesson_ids):
        _answer(pack, state, lesson_id, correct=index % 2 == 0)
    # Шестой ответ вытесняет первый — окно остаётся размером пять.
    _answer(pack, state, "POL01_C", correct=True)
    civ = engine.metrics(pack, state)["CIV"]
    assert civ.n == 5
    assert civ.errors == 2


def test_metrics_prior_smooths_cold_start(pack) -> None:
    state = engine.State()
    cold = engine.metrics(pack, state)["CIV"]
    assert (cold.n, cold.errors) == (0, 0)
    assert cold.need == Fraction(2, 4)
    assert cold.state == c.STATE_NOT_ASSESSED

    _answer(pack, state, "CIV01_C", correct=False)
    warm = engine.metrics(pack, state)["CIV"]
    assert warm.need == Fraction(3, 5)
    assert warm.state == c.STATE_LIMITED


def test_metrics_exclude_voided_before_window(pack) -> None:
    """Отозванное наблюдение не должно сдвигать окно: иначе ошибка «прощается»."""
    state = engine.State()
    for index, lesson_id in enumerate(f"CIV{order:02d}_C" for order in range(1, 6)):
        _answer(pack, state, lesson_id, correct=index != 0)
    before = engine.metrics(pack, state)["CIV"]
    assert (before.n, before.errors) == (5, 1)

    first_attempt = state.observations[0].attempt_id
    assert engine.void_observation(state, first_attempt) is True
    after = engine.metrics(pack, state)["CIV"]
    assert (after.n, after.errors) == (4, 0)
    assert engine.void_observation(state, first_attempt) is False


def test_auto_choice_walks_topics_then_rotates(pack) -> None:
    """Пока темы равны, выдача идёт по порядку; две подряд по одной — ротация.

    Автоматическая выдача не повторяет тему, пока есть непройденные: после
    первой выдачи CIV приоритет у неё тот же, но ``n != 0`` уводит выбор к
    следующей теме. Ротация включается, когда две выдачи подряд всё же пришлись
    на одну тему — например, после серии ошибок по ней.
    """
    state = engine.State()
    chosen = []
    for _ in range(3):
        choice = engine.choose(pack, state)
        chosen.append(choice.topic_id)
        engine.issue(pack, state, choice.item_id, mode=c.MODE_FRESH_CASE, origin=c.ORIGIN_AUTO)
        engine.act(pack, state, state.open_attempt_id, "skip")
    assert chosen == ["CIV", "POL", "BUY"]


def test_rotation_switches_topic_after_two_auto_shows(pack) -> None:
    state = engine.State()
    state.auto_shows = [
        engine.AutoShow(topic_id="CIV", seq=1, attempt_id="a1"),
        engine.AutoShow(topic_id="CIV", seq=2, attempt_id="a2"),
    ]
    choice = engine.choose(pack, state)
    assert choice.kind == c.CHOICE_NEW_CASE
    assert choice.reason == c.REASON_ROTATE_TOPIC
    assert choice.topic_id != "CIV"


def test_rotation_prefers_untested_topic(pack) -> None:
    """Среди альтернатив ротация сначала берёт тему без наблюдений."""
    state = engine.State()
    state.auto_shows = [
        engine.AutoShow(topic_id="CIV", seq=1, attempt_id="a1"),
        engine.AutoShow(topic_id="CIV", seq=2, attempt_id="a2"),
    ]
    # POL уже отвечена, остальные — нет.
    _answer(pack, state, "POL01_C")
    choice = engine.choose(pack, state)
    assert choice.topic_id != "POL"
    assert engine.metrics(pack, state)[choice.topic_id].n == 0


def test_explicit_topic_is_respected(pack) -> None:
    choice = engine.choose(pack, engine.State(), topic_id="WORK")
    assert choice.topic_id == "WORK"
    assert choice.reason == c.REASON_USER_TOPIC
    assert choice.origin == c.ORIGIN_MANUAL
    assert choice.item_id.startswith("WORK")


def test_lesson_choice_returns_lesson(pack) -> None:
    choice = engine.choose(pack, engine.State(), lesson_id="BUY03")
    assert choice.kind == c.CHOICE_LESSON
    assert choice.lesson_id == "BUY03"
    assert choice.reason == c.REASON_USER_LESSON


def test_open_attempt_resumes(pack) -> None:
    state = engine.State()
    attempt = engine.issue(pack, state, "DEBT01_R1", mode=c.MODE_FRESH_CASE, origin=c.ORIGIN_AUTO)
    resume = engine.choose(pack, state)
    assert resume.kind == c.CHOICE_RESUME
    assert resume.attempt_id == attempt.id
    assert resume.reason == c.REASON_OPEN_ATTEMPT


def test_bad_choice_inputs_rejected(pack) -> None:
    with pytest.raises(EngineError, match="UNKNOWN_TOPIC"):
        engine.choose(pack, engine.State(), topic_id="NOPE")
    with pytest.raises(EngineError, match="AMBIGUOUS_CHOICE"):
        engine.choose(pack, engine.State(), topic_id="CIV", lesson_id="CIV01")


def test_fresh_cases_exhausted_offers_review(pack) -> None:
    """Когда свежие кейсы кончились, повтор предлагается, но не открывается сам."""
    state = engine.State()
    for item_id in sorted(i for i in pack.items if i.startswith("CIV") and i.endswith("_R1")):
        engine.issue(pack, state, item_id, mode=c.MODE_FRESH_CASE, origin=c.ORIGIN_MANUAL)
        engine.act(pack, state, state.open_attempt_id, "skip")
    choice = engine.choose(pack, state, topic_id="CIV")
    assert choice.kind == c.CHOICE_REVIEW
    assert choice.reason == c.REASON_FRESH_EXHAUSTED
    assert choice.topic_id == "CIV"


# --- Зачёт ----------------------------------------------------------------


def test_help_does_not_close_attempt_but_blocks_counting(pack) -> None:
    state = engine.State()
    attempt = engine.issue(pack, state, "HOME01_C", mode=c.MODE_CHECK, origin=c.ORIGIN_LESSON)
    help_result = engine.act(pack, state, attempt.id, "help")

    assert help_result["status"] == "open"
    assert help_result["assistance"]
    assert "already_closed" not in help_result
    assert state.open_attempt_id == attempt.id

    correct = pack.items["HOME01_C"]["correct_option_id"]
    result = engine.act(pack, state, attempt.id, "answer", correct)
    assert result["counted"] is False
    assert result["reason"] == c.REASON_ASSISTED
    assert state.observations == []


def test_guide_mode_is_not_assessment(pack) -> None:
    state = engine.State()
    result = _answer(pack, state, "CIV01_G", mode=c.MODE_GUIDE, origin=c.ORIGIN_LESSON)
    assert result["counted"] is False
    assert result["reason"] == c.REASON_NOT_ASSESSMENT


def test_second_attempt_on_same_family_is_family_seen(pack) -> None:
    state = engine.State()
    first = _answer(pack, state, "POL01_C")
    assert first["counted"] is True

    # Тот же урок, другая карточка внутри семьи — зачёт уже не положен.
    second = engine.issue(pack, state, "POL01_R1", mode=c.MODE_PRACTICE, origin=c.ORIGIN_LESSON)
    result = engine.act(pack, state, second.id, "answer", pack.items["POL01_R1"]["correct_option_id"])
    assert result["counted"] is False
    assert result["reason"] == c.REASON_PRACTICE  # practice отсекается раньше FAMILY_SEEN


def test_skip_and_reveal_reasons(pack) -> None:
    state = engine.State()
    attempt = engine.issue(pack, state, "BUY02_C", mode=c.MODE_CHECK, origin=c.ORIGIN_LESSON)
    skipped = engine.act(pack, state, attempt.id, "skip")
    assert (skipped["status"], skipped["reason"], skipped["counted"]) == ("skipped", c.REASON_SKIP, False)
    assert "correct_option_id" not in skipped

    reveal = engine.issue(pack, state, "BUY03_C", mode=c.MODE_CHECK, origin=c.ORIGIN_LESSON)
    revealed = engine.act(pack, state, reveal.id, "reveal")
    assert revealed["reason"] == c.REASON_REVEAL
    assert revealed["correct_option_id"] == pack.items["BUY03_C"]["correct_option_id"]
    assert "correct" not in revealed


def test_repeated_action_returns_already_closed(pack) -> None:
    """Две вкладки с разными ответами: выигрывает первый, второй не меняет исход."""
    state = engine.State()
    attempt = engine.issue(pack, state, "DEBT02_C", mode=c.MODE_CHECK, origin=c.ORIGIN_LESSON)
    item = pack.items["DEBT02_C"]
    wrong = next(o["id"] for o in item["options"] if o["id"] != item["correct_option_id"])
    first = engine.act(pack, state, attempt.id, "answer", wrong)
    second = engine.act(pack, state, attempt.id, "answer", item["correct_option_id"])

    assert first["counted"] is True and first["correct"] is False
    assert second["already_closed"] is True
    assert second["reason"] == c.REASON_COUNTED
    assert len(state.observations) == 1


def test_issue_rejects_bad_requests(pack) -> None:
    state = engine.State()
    engine.issue(pack, state, "CIV01_R1", mode=c.MODE_FRESH_CASE, origin=c.ORIGIN_AUTO)
    with pytest.raises(EngineError, match="OPEN_ATTEMPT"):
        engine.issue(pack, state, "CIV02_R1", mode=c.MODE_FRESH_CASE, origin=c.ORIGIN_AUTO)
    with pytest.raises(EngineError, match="UNKNOWN_ITEM"):
        engine.issue(pack, engine.State(), "НЕТ", mode=c.MODE_CHECK, origin=c.ORIGIN_LESSON)
    with pytest.raises(EngineError, match="WRONG_MODE"):
        engine.issue(pack, engine.State(), "CIV01_C", mode=c.MODE_FRESH_CASE, origin=c.ORIGIN_LESSON)
    with pytest.raises(EngineError, match="BAD_ORIGIN"):
        # auto допустим только для свежего кейса: иначе клиент накрутил бы выдачу
        engine.issue(pack, engine.State(), "CIV01_R1", mode=c.MODE_PRACTICE, origin=c.ORIGIN_AUTO)
    with pytest.raises(EngineError, match="FAMILY_SEEN"):
        engine.issue(pack, engine.State(), "CIV01_R1", mode=c.MODE_FRESH_CASE, origin=c.ORIGIN_AUTO)
        engine.act(pack, state, state.open_attempt_id, "skip")
        engine.issue(pack, state, "CIV01_R1", mode=c.MODE_FRESH_CASE, origin=c.ORIGIN_AUTO)


def test_bad_option_rejected(pack) -> None:
    state = engine.State()
    attempt = engine.issue(pack, state, "WORK01_C", mode=c.MODE_CHECK, origin=c.ORIGIN_LESSON)
    with pytest.raises(EngineError, match="BAD_OPTION"):
        engine.act(pack, state, attempt.id, "answer", "Z")


def test_public_item_hides_answer(pack) -> None:
    """Ключ не должен утекать в карточку до ответа."""
    card = engine.public_item(pack, "CIV01_R1")
    assert card["options"] and all(set(option) == {"id", "text"} for option in card["options"])
    for leaked in ("correct_option_id", "legal_basis_ids", "provenance", "source_trace", "hint"):
        assert leaked not in card


def test_lesson_payload_carries_theory(pack) -> None:
    payload = engine.lesson_payload(pack, "POL02")
    assert payload["theory"]
    assert payload["actions"]
    assert payload["control_item_id"] == pack.lessons["POL02"]["control_id"]


def test_cancelled_attempt_does_not_count(pack) -> None:
    """Отзыв карточки закрывает попытку без зачёта, ключ не раскрывается."""
    state = engine.State()
    attempt = engine.issue(pack, state, "HOME04_C", mode=c.MODE_CHECK, origin=c.ORIGIN_LESSON)
    raw = json.loads(json.dumps(pack.raw))
    raw["items"]["HOME04_C"]["legal_review_status"] = "retired"
    retired = Pack(raw)

    engine.cancel_obsolete(retired, state)
    assert attempt.status == "cancelled"
    assert attempt.counted is False
    assert attempt.reason == c.REASON_CONTENT_UNAVAILABLE
    assert state.open_attempt_id is None


def test_draft_pack_needs_sandbox(pack) -> None:
    """Черновик без песочницы не выдаётся: снаружи это «контента нет»."""
    raw = json.loads(json.dumps(pack.raw))
    for row in list(raw["lessons"].values()) + list(raw["items"].values()):
        row["legal_review_status"] = "pending_expert_review"
    draft = Pack(raw)
    choice = engine.choose(draft, engine.State())
    assert choice.kind == c.CHOICE_NONE
    assert choice.reason == c.REASON_NO_PUBLISHED_CONTENT

    sandboxed = engine.choose(draft, engine.State(), sandbox=True)
    assert sandboxed.kind == c.CHOICE_NEW_CASE


def test_retired_content_is_withheld(pack) -> None:
    raw = json.loads(json.dumps(pack.raw))
    raw["items"]["CIV01_R1"]["legal_review_status"] = "retired"
    retired = Pack(raw)
    choice = engine.choose(retired, engine.State())
    assert choice.item_id != "CIV01_R1"


# --- Дифференциальная сверка с эталоном -----------------------------------


def _strip_none(mapping: dict) -> dict:
    return {key: value for key, value in mapping.items() if value is not None}


def _run_scenario(raw: dict, reference, seed: int, steps: int = 60) -> int:
    """Прогоняет одинаковый случайный сценарий через оба движка.

    Оба движка получают **один и тот же** вход: на опубликованном паке эталон
    из спецификации отказывается работать (его ``self_test`` рассчитан на
    черновик), поэтому сверка идёт на черновой копии. Песочница включается для
    части сценариев — так проверяются обе ветки допуска.
    """
    pack = Pack(raw)
    rng = random.Random(seed)
    weights = None
    if seed % 3 == 1:
        weights = {topic: rng.choice([80, 85, 100, 115, 120]) for topic in raw["topics"]}
    sandbox = seed % 4 == 2

    ref_state = reference.new_state()
    our_state = engine.State()
    done = 0

    for step in range(steps):
        op = rng.choices(
            ["choose", "choose", "issue", "act", "act", "act", "void"],
            weights=[3, 3, 3, 5, 5, 5, 1],
        )[0]
        topic = rng.choice([None, None, None, "CIV", "POL", "BUY", "DEBT", "HOME", "WORK"])
        lesson = rng.choice([None, None, None, None, "CIV01", "POL03", "WORK05"])
        where = f"seed={seed} step={step}"

        if op == "choose":
            if topic is not None and lesson is not None:
                lesson = None
            try:
                expected = reference.choose(
                    raw, ref_state, topic_id=topic, lesson_id=lesson,
                    weights=weights, sandbox=sandbox,
                )
                expected_error = None
            except ValueError as exc:
                expected_error = str(exc)
            try:
                got = engine.choose(
                    pack, our_state, topic_id=topic, lesson_id=lesson,
                    weights=weights, sandbox=sandbox,
                ).as_dict()
                got_error = None
            except EngineError as exc:
                got_error = str(exc)
            assert got_error == expected_error, f"{where} choose: {expected_error} != {got_error}"
            done += 1
            if expected_error:
                continue
            assert _strip_none(got) == _strip_none(expected), f"{where} choose: {expected} != {got}"

        elif op == "issue":
            item_id = rng.choice(sorted(pack.items))
            kind = pack.items[item_id]["kind"]
            mode = rng.choice({
                c.KIND_GUIDE: [c.MODE_GUIDE, c.MODE_PRACTICE],
                c.KIND_LESSON_CHECK: [c.MODE_CHECK, c.MODE_PRACTICE],
                c.KIND_RECOMMEND_CASE: [c.MODE_FRESH_CASE, c.MODE_PRACTICE],
            }[kind])
            origin = rng.choice([c.ORIGIN_AUTO, c.ORIGIN_MANUAL, c.ORIGIN_LESSON])

            ref_snapshot = json.loads(json.dumps(ref_state))
            our_snapshot = copy.deepcopy(our_state)
            try:
                reference.issue(raw, ref_state, item_id, mode=mode, origin=origin, sandbox=sandbox)
                expected_error = None
            except ValueError as exc:
                expected_error = str(exc)
                # Эталон валидирует уже после cancel_obsolete и может оставить
                # побочный эффект. Откатываем, иначе сценарии разъедутся из-за
                # неудачного вызова, а не из-за логики.
                ref_state = ref_snapshot
            try:
                engine.issue(pack, our_state, item_id, mode=mode, origin=origin, sandbox=sandbox)
                got_error = None
            except EngineError as exc:
                got_error = str(exc)
                our_state = our_snapshot
            assert got_error == expected_error, (
                f"{where} issue({item_id},{mode},{origin}): {expected_error} != {got_error}"
            )
            done += 1

        elif op == "act":
            if not our_state.attempts:
                continue
            attempt_id = rng.choice(sorted(our_state.attempts))
            action = rng.choice(["answer", "answer", "answer", "help", "skip", "reveal"])
            option = None
            if action == "answer":
                options = [o["id"] for o in pack.items[our_state.attempts[attempt_id].item_id]["options"]]
                option = rng.choice(options + ["Z"])
            try:
                expected = reference.act(raw, ref_state, attempt_id, action, option, sandbox=sandbox)
                expected_error = None
            except (ValueError, KeyError) as exc:
                expected_error = str(exc)
            try:
                got = engine.act(pack, our_state, attempt_id, action, option, sandbox=sandbox)
                got_error = None
            except EngineError as exc:
                got_error = str(exc)
            assert got_error == expected_error, (
                f"{where} act({attempt_id},{action},{option}): {expected_error} != {got_error}"
            )
            done += 1
            if expected_error:
                continue
            # В эталоне варианты называются ``feedback`` — это единственное
            # намеренное расхождение в именах полей ответа.
            expected_cmp = dict(expected)
            if "feedback" in expected_cmp:
                expected_cmp["options"] = expected_cmp.pop("feedback")
            assert _strip_none(got) == _strip_none(expected_cmp), (
                f"{where} act result: {expected_cmp} != {got}"
            )

        elif op == "void":
            if not our_state.attempts:
                continue
            attempt_id = rng.choice(sorted(our_state.attempts))
            expected = False
            for observation in ref_state["observations"]:
                if observation["attempt_id"] == attempt_id and not observation["voided"]:
                    observation["voided"] = True
                    expected = True
                    break
            assert engine.void_observation(our_state, attempt_id) is expected, f"{where} void"
            done += 1

        # Метрики обязаны совпадать после каждого шага — это ловит дрейф окна.
        expected_metrics = {
            topic: (row["n"], row["errors"], row["need"], row["priority"], row["label"])
            for topic, row in reference.metrics(raw, ref_state, weights).items()
        }
        got_metrics = {
            topic: (row.n, row.errors, row.need, row.priority, row.state)
            for topic, row in engine.metrics(pack, our_state, weights).items()
        }
        assert got_metrics == expected_metrics, f"{where} metrics: {expected_metrics} != {got_metrics}"

    return done


def test_engine_matches_reference_on_random_scenarios(draft_pack, reference) -> None:
    """Случайные последовательности дают одинаковый результат в обоих движках.

    Одинаковый вход и одинаковое состояние должны давать одинаковый кейс — это
    и есть проверяемость: поведение можно воспроизвести по журналу.
    """
    total = 0
    for seed in range(30):
        total += _run_scenario(draft_pack, reference, seed)
    # Порог — защита от «тест прошёл, потому что ничего не выполнилось».
    assert total > 700


def test_reference_self_test_passes_on_draft_copy(draft_pack, reference) -> None:
    """Эталон проходит свои 35 проверок — вход для сверки корректный."""
    reference.self_test(draft_pack)
