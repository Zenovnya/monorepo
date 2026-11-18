"""Рассылка push-уведомлений: стрик, ежедневная цель, повторения.

Вызывается по расписанию (см. ``POST /admin/notifications/dispatch`` и
``scripts/send-reminders.py``): планировщика в проекте нет, поэтому запуск
идёт из cron/Railway Scheduled Jobs.

Ключевые решения:

* Рассылка идемпотентна: на каждого пользователя и тип пишется отметка в
  ``notification_deliveries`` с уникальным индексом (user_id, type, day).
  В compose два воркера — параллельный запуск не должен слать дубли.
* Учитываются настройки пользователя (``notification_settings``): каждый тип
  можно отключить отдельно.
* Токены, на которые Expo ответил ``DeviceNotRegistered``, гасятся
  (``is_active = False``), иначе квота тратится впустую.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app import push
from app.modules.notifications.models import (
    Notification,
    NotificationDelivery,
    NotificationSettings,
    PushToken,
)
from app.modules.progress.models import DailyXp, ReviewState

logger = logging.getLogger(__name__)

TYPE_STREAK = "streak_reminder"
TYPE_DAILY_GOAL = "daily_goal_reminder"
TYPE_REVIEW = "review_reminder"


async def get_settings_for_user(
    session: AsyncSession, user_id: uuid.UUID
) -> NotificationSettings:
    """Возвращает настройки уведомлений, создавая дефолтные при первом обращении."""
    settings = await session.scalar(
        select(NotificationSettings).where(
            NotificationSettings.user_id == user_id
        )
    )
    if settings is None:
        settings = NotificationSettings(user_id=user_id)
        session.add(settings)
        await session.flush()
    return settings


async def _already_delivered(
    session: AsyncSession, user_id: uuid.UUID, type_: str, day: date
) -> bool:
    existing = await session.scalar(
        select(NotificationDelivery).where(
            NotificationDelivery.user_id == user_id,
            NotificationDelivery.type == type_,
            NotificationDelivery.day == day,
        )
    )
    return existing is not None


def _mark_delivered(
    session: AsyncSession, user_id: uuid.UUID, type_: str, day: date
) -> None:
    session.add(NotificationDelivery(user_id=user_id, type=type_, day=day))


async def _active_tokens(
    session: AsyncSession, user_id: uuid.UUID
) -> list[PushToken]:
    result = await session.scalars(
        select(PushToken).where(
            PushToken.user_id == user_id,
            PushToken.is_active.is_(True),
        )
    )
    return list(result.all())


async def _deactivate_tokens(
    session: AsyncSession, tokens: list[str]
) -> None:
    if not tokens:
        return
    rows = await session.scalars(
        select(PushToken).where(PushToken.token.in_(tokens))
    )
    for row in rows.all():
        row.is_active = False


class _Plan:
    """Что отправлять конкретному пользователю."""

    def __init__(self, type_: str, title: str, body: str) -> None:
        self.type = type_
        self.title = title
        self.body = body


async def _plan_for_user(
    session: AsyncSession,
    user: User,
    settings: NotificationSettings,
    today: date,
    now: datetime,
) -> list[_Plan]:
    """Решает, какие напоминания нужны пользователю сегодня."""
    plans: list[_Plan] = []

    # 1) Стрик: активность была вчера, сегодня ещё нет — серия под угрозой.
    if (
        settings.streak_reminders
        and user.streak > 0
        and user.last_active_day is not None
        and user.last_active_day.date() != today
    ):
        plans.append(
            _Plan(
                TYPE_STREAK,
                f"Стрик {user.streak} под угрозой 🔥",
                "Пройдите хотя бы один урок сегодня, чтобы не потерять серию.",
            )
        )

    # 2) Ежедневная цель: цель задана, но ещё не выполнена.
    if settings.daily_goal_reminders and (user.daily_goal or 0) > 0:
        day_start = datetime(
            today.year, today.month, today.day, tzinfo=timezone.utc
        )
        row = await session.scalar(
            select(DailyXp).where(
                DailyXp.user_id == user.id, DailyXp.day == day_start
            )
        )
        done = row.xp if row is not None else 0
        if done < user.daily_goal:
            plans.append(
                _Plan(
                    TYPE_DAILY_GOAL,
                    "Цель дня ещё не закрыта ✦",
                    f"{done} из {user.daily_goal} XP. Один короткий урок — и норма выполнена.",
                )
            )

    # 3) Повторения: есть кейсы, срок которых наступил.
    if settings.review_reminders:
        due = await session.scalar(
            select(ReviewState.id)
            .where(
                ReviewState.user_id == user.id,
                ReviewState.due_at <= now,
            )
            .limit(1)
        )
        if due is not None:
            plans.append(
                _Plan(
                    TYPE_REVIEW,
                    "Пора повторить нормы ↻",
                    "Есть кейсы, срок повторения которых наступил. Пять минут — и они снова в памяти.",
                )
            )

    return plans


async def dispatch_reminders(
    session: AsyncSession,
    *,
    user_id: uuid.UUID | None = None,
    dry_run: bool = False,
) -> dict:
    """Рассылает напоминания (всем пользователям или одному).

    ``dry_run`` считает, что было бы отправлено, не трогая БД и не дергая Expo.
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    query = select(User).where(User.is_active.is_(True))
    if user_id is not None:
        query = query.where(User.id == user_id)
    users = list((await session.scalars(query)).all())

    report = {
        "users_checked": len(users),
        "planned": 0,
        "sent": 0,
        "skipped_already_sent": 0,
        "skipped_no_tokens": 0,
        "failed": 0,
        "deactivated_tokens": 0,
        "dry_run": dry_run,
    }

    for user in users:
        settings = await get_settings_for_user(session, user.id)
        plans = await _plan_for_user(session, user, settings, today, now)

        for plan in plans:
            report["planned"] += 1

            if await _already_delivered(session, user.id, plan.type, today):
                report["skipped_already_sent"] += 1
                continue

            tokens = await _active_tokens(session, user.id)
            if not tokens:
                report["skipped_no_tokens"] += 1
                continue

            if dry_run:
                continue

            messages = push.messages_for_tokens(
                tokens,
                title=plan.title,
                body=plan.body,
                data={"type": plan.type},
            )
            result = await push.send_push_messages(messages)
            report["sent"] += result.sent
            report["failed"] += result.failed

            if result.invalid_tokens:
                await _deactivate_tokens(session, result.invalid_tokens)
                report["deactivated_tokens"] += len(result.invalid_tokens)

            # Внутреннее уведомление (лента в настройках) + отметка об отправке.
            session.add(
                Notification(
                    user_id=user.id,
                    type=plan.type,
                    title=plan.title,
                    body=plan.body,
                )
            )
            _mark_delivered(session, user.id, plan.type, today)

            try:
                await session.flush()
            except IntegrityError:
                # Параллельный воркер успел отметить этот же тип за этот день.
                await session.rollback()
                report["skipped_already_sent"] += 1
                continue

    if not dry_run:
        await session.commit()

    return report


async def send_test_push(
    session: AsyncSession, user_id: uuid.UUID
) -> dict:
    """Отправляет тестовое уведомление на все устройства пользователя.

    Нужен, чтобы проверить связку «токен → Expo → устройство» без ожидания
    cron: отсутствие push легко не заметить до релиза.
    """
    tokens = await _active_tokens(session, user_id)
    if not tokens:
        return {"sent": 0, "failed": 0, "reason": "нет активных устройств"}

    messages = push.messages_for_tokens(
        tokens,
        title="LexBear на связи 🐻",
        body="Уведомления настроены: напомним про стрик, цель дня и повторения.",
        data={"type": "test"},
    )
    result = await push.send_push_messages(messages)

    if result.invalid_tokens:
        await _deactivate_tokens(session, result.invalid_tokens)

    session.add(
        Notification(
            user_id=user_id,
            type="test",
            title="LexBear на связи 🐻",
            body="Уведомления настроены.",
        )
    )
    await session.commit()
    return result.as_dict()
