"""Реализация интервального алгоритма повторения SM-2.

SM-2 (SuperMemo) — классический алгоритм планирования повторений.
Чистая функция: не зависит от БД, легко покрывается юнит-тестами.

Вход: качество ответа q (0..5).
Выход: обновлённые (repetitions, interval_days, ease_factor).
"""

from dataclasses import dataclass

# Нижняя граница фактора лёгкости.
MIN_EASE_FACTOR = 1.3


@dataclass(frozen=True)
class Sm2Result:
    """Результат применения SM-2 к одной карточке."""

    repetitions: int
    interval_days: int
    ease_factor: float


def sm2(
    quality: int,
    repetitions: int = 0,
    interval_days: int = 0,
    ease_factor: float = 2.5,
) -> Sm2Result:
    """Применяет алгоритм SM-2 к параметрам карточки.

    Args:
        quality: оценка качества ответа от 0 до 5.
        repetitions: число успешных повторений подряд на текущий момент.
        interval_days: текущий интервал в днях.
        ease_factor: текущий фактор лёгкости (>= MIN_EASE_FACTOR).

    Returns:
        Обновлённые параметры планирования.
    """
    if not 0 <= quality <= 5:
        raise ValueError("quality должен быть в диапазоне 0..5")

    # Качество < 3 — ответ неверный: сбрасываем повторения, интервал = 1 день.
    if quality < 3:
        return Sm2Result(
            repetitions=0,
            interval_days=1,
            ease_factor=ease_factor,
        )

    # Успешный ответ: увеличиваем счётчик повторений.
    new_repetitions = repetitions + 1

    # Интервал по правилам SM-2.
    if new_repetitions == 1:
        new_interval = 1
    elif new_repetitions == 2:
        new_interval = 6
    else:
        new_interval = round(interval_days * ease_factor)

    # Обновляем фактор лёгкости (минимум MIN_EASE_FACTOR).
    new_ease = ease_factor + (
        0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    )
    new_ease = max(MIN_EASE_FACTOR, new_ease)

    return Sm2Result(
        repetitions=new_repetitions,
        interval_days=new_interval,
        ease_factor=new_ease,
    )