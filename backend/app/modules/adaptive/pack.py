"""Загрузка и проверка пака тем (``themes.json``).

Проверка — по правилам импорта из спецификации: уникальные ID, ссылки, ровно
пять уроков на тему, тройка вариантов с одним ключом, совпадение темы и тега с
уроком, контрольная карточка не в семье разбора, допуск по юридической
проверке и ссылки на нормы. Битый пак должен падать на импорте, а не
превращаться в нерешаемый вопрос у ученика.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.modules.adaptive import constants as c
from app.modules.adaptive.errors import EngineError, require

# Каталог с паками: тот же, что у остального контента.
DEFAULT_THEMES_PATH = Path(__file__).resolve().parents[2] / "content_packs" / "themes.json"


@dataclass(frozen=True)
class Pack:
    """Пак контента в терминах движка.

    Хранится в памяти как есть: 6 тем, 30 уроков и 90 карточек — сотни
    килобайт, дробить кэш незачем.
    """

    raw: dict[str, Any]

    @property
    def topics(self) -> dict[str, dict]:
        return self.raw["topics"]

    @property
    def lessons(self) -> dict[str, dict]:
        return self.raw["lessons"]

    @property
    def items(self) -> dict[str, dict]:
        return self.raw["items"]

    @property
    def authorities(self) -> dict[str, dict]:
        return self.raw["legal_authorities"]

    @property
    def algorithm(self) -> dict[str, Any]:
        return self.raw["algorithm"]

    @property
    def release_key(self) -> str:
        return f"{self.raw['pack_id']}@{self.raw['pack_version']}"

    def lessons_of(self, topic_id: str) -> list[dict[str, Any]]:
        """Уроки темы в порядке прохождения.

        Список уроков в самой теме не хранится — он выводится из уроков. Так
        нельзя получить урок, которого нет, или потерять урок при переносе.
        """
        return sorted(
            (row for row in self.lessons.values() if row["primary_topic_id"] == topic_id),
            key=lambda row: row["order"],
        )

    @property
    def editorial_note(self) -> str | None:
        return self.raw.get("editorial_note")


def validate(pack: Pack) -> None:
    """Проверяет пак; при ошибке бросает ``EngineError`` с кодом."""
    raw = pack.raw
    require(raw.get("schema_version") == c.SCHEMA_VERSION, "UNKNOWN_SCHEMA")
    require(pack.algorithm.get("version") == c.ALGORITHM_VERSION, "UNKNOWN_ALGORITHM")
    require(
        (
            pack.algorithm["window_size"],
            pack.algorithm["prior_errors"],
            pack.algorithm["prior_answers"],
            pack.algorithm["max_auto_topic_streak"],
        )
        == (c.WINDOW_SIZE, c.PRIOR_ERRORS, c.PRIOR_ANSWERS, c.MAX_AUTO_TOPIC_STREAK),
        "ALGORITHM_PARAMETERS",
    )
    require(
        (
            pack.algorithm["weight_min_pct"],
            pack.algorithm["weight_max_pct"],
            pack.algorithm["weight_step_pct"],
        )
        == (c.WEIGHT_MIN_PCT, c.WEIGHT_MAX_PCT, c.WEIGHT_STEP_PCT),
        "WEIGHT_PARAMETERS",
    )

    for name, mapping in (
        ("topic", pack.topics),
        ("lesson", pack.lessons),
        ("item", pack.items),
        ("authority", pack.authorities),
    ):
        require(all(key == row["id"] for key, row in mapping.items()), "BAD_ID_" + name)

    require(
        len(pack.topics) == 6
        and sorted(topic["order"] for topic in pack.topics.values()) == list(range(1, 7)),
        "TOPICS",
    )
    for topic_id in pack.topics:
        orders = sorted(
            lesson["order"]
            for lesson in pack.lessons.values()
            if lesson["primary_topic_id"] == topic_id
        )
        require(orders == [1, 2, 3, 4, 5], "LESSON_ORDER")

    for lesson in pack.lessons.values():
        require(lesson["primary_topic_id"] in pack.topics, "LESSON_TOPIC")
        guide = pack.items.get(lesson["guide_id"])
        control = pack.items.get(lesson["control_id"])
        require(guide is not None and control is not None, "PAIR")
        require(
            guide["lesson_id"] == control["lesson_id"] == lesson["id"]
            and guide["kind"] == c.KIND_GUIDE
            and control["kind"] == c.KIND_LESSON_CHECK,
            "PAIR",
        )

    family_scope: dict[str, tuple[str, str]] = {}
    for item in pack.items.values():
        lesson = pack.lessons.get(item["lesson_id"])
        require(lesson is not None, "ITEM_LESSON")
        require(item["kind"] in c.SCORE_KINDS | {c.KIND_GUIDE}, "ITEM_KIND")
        require(
            item["primary_topic_id"] == lesson["primary_topic_id"]
            and item["subtopic_id"] == lesson["subtopic_id"],
            "SUBTOPIC",
        )
        require(
            set(item["secondary_topic_ids"]) <= (pack.topics.keys() - {item["primary_topic_id"]}),
            "SECONDARY_TOPIC",
        )
        # Ровно три варианта с идентификаторами A/B/C: клиент показывает буквы,
        # сервер сверяет id, позиция и порядок не участвуют в проверке.
        require(
            {option["id"] for option in item["options"]} == {"A", "B", "C"}
            and len(item["options"]) == 3,
            "OPTIONS",
        )
        require(item["correct_option_id"] in {o["id"] for o in item["options"]}, "ANSWER_KEY")
        require(
            all(o["text"].strip() and o["explanation"].strip() for o in item["options"]),
            "OPTION_TEXT",
        )
        # Подсказка живёт только в разборе: в проверке она была бы утечкой.
        require(item["kind"] == c.KIND_GUIDE or "hint" not in item, "CHECK_HINT_LEAK")
        if item["kind"] != c.KIND_RECOMMEND_CASE:
            expected = lesson["guide_id"] if item["kind"] == c.KIND_GUIDE else lesson["control_id"]
            require(item["id"] == expected, "UNLINKED_ITEM")
        scope = (item["primary_topic_id"], item["subtopic_id"])
        require(family_scope.setdefault(item["evidence_family_id"], scope) == scope, "FAMILY_SCOPE")
        if item["kind"] != c.KIND_GUIDE:
            # Контрольная карточка не может быть в семье разобранного примера:
            # иначе «новый» кейс окажется тем же, что ученик уже разбирал.
            require(
                item["evidence_family_id"]
                != pack.items[lesson["guide_id"]]["evidence_family_id"],
                "GUIDE_FAMILY_LEAK",
            )

    # Общие поля уроков и карточек. Проверка подписи здесь, а не только при
    # выдаче: пак с ``approved`` без подписи проходил импорт, а потом все его
    # карточки молча становились недоступны — снаружи это выглядело как
    # «контент пропал». Лучше упасть на импорте.
    for row in list(pack.lessons.values()) + list(pack.items.values()):
        require(
            type(row["content_version"]) is int and row["content_version"] >= 1,
            "CONTENT_VERSION",
        )
        require(row["legal_review_status"] in c.STATUSES, "REVIEW_STATUS")
        require(
            row["legal_review_status"] != c.STATUS_APPROVED
            or bool(row.get("expert_signoff_id") and row.get("expert_approved_on")),
            "MISSING_SIGNOFF",
        )
        require(
            bool(row["legal_basis_ids"])
            and set(row["legal_basis_ids"]) <= pack.authorities.keys(),
            "LEGAL_BASIS",
        )

    validate_weights(pack, None)


def valid_row(row: dict, sandbox: bool = False) -> bool:
    """Допущена ли карточка или урок к выдаче.

    ``approved`` требует подписи и даты. Черновики допустимы только в
    песочнице (``sandbox``) — это режим разработки, а не «показываем всё».
    """
    if row["legal_review_status"] == c.STATUS_APPROVED:
        return bool(row.get("expert_signoff_id") and row.get("expert_approved_on"))
    return sandbox and row["legal_review_status"] in c.DRAFT_STATUSES


def available(pack: Pack, item: dict, sandbox: bool = False) -> bool:
    """Карточка доступна, если допущены и она сама, и родительский урок."""
    return valid_row(item, sandbox) and valid_row(pack.lessons[item["lesson_id"]], sandbox)


def validate_weights(pack: Pack, weights: dict[str, int] | None) -> dict[str, int]:
    """Веса: 6 тем, целые 80–120 с шагом 5. Иначе редактор ошибся."""
    resolved = (
        {topic_id: row["weight_pct"] for topic_id, row in pack.topics.items()}
        if weights is None
        else weights
    )
    require(resolved.keys() == pack.topics.keys(), "WEIGHT_TOPICS")
    require(
        all(
            isinstance(value, int)
            and not isinstance(value, bool)
            and c.WEIGHT_MIN_PCT <= value <= c.WEIGHT_MAX_PCT
            and value % c.WEIGHT_STEP_PCT == 0
            for value in resolved.values()
        ),
        "WEIGHT_RANGE",
    )
    return resolved


def load_pack(path: Path | str | None = None) -> Pack:
    """Читает пак с диска и проверяет его."""
    target = Path(path) if path is not None else DEFAULT_THEMES_PATH
    try:
        raw = json.loads(target.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise EngineError("PACK_NOT_FOUND") from exc
    except json.JSONDecodeError as exc:
        raise EngineError("PACK_INVALID_JSON") from exc
    pack = Pack(raw=raw)
    validate(pack)
    return pack


@lru_cache(maxsize=1)
def get_pack() -> Pack:
    """Пак по умолчанию (кешируется: файл не меняется на ходу)."""
    return load_pack()
