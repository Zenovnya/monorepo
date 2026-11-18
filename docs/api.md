# API Лапы закона (LexBear)

Справочник по HTTP-API бэкенда. Полная машиночитаемая схема — на самом сервисе:
`GET /docs` (Swagger UI) и `GET /openapi.json`.

- Базовый префикс: `/` (модули развешивают свои префиксы: `/auth`, `/user`,
  `/lexbear`, `/gamification`, …).
- Формат — JSON, кодировка UTF-8.
- Аутентификация — `Authorization: Bearer <access_token>` там, где указана.
  Access-токен живёт 60 минут (`ACCESS_TOKEN_EXPIRE_MINUTES`), refresh — 30 дней.
- Ошибки — стандартный FastAPI-формат: `{"detail": "текст"}` либо
  `{"detail": {"code": "...", "message": "...", ...}}`, когда клиенту нужны
  структурированные данные (пример — кончившиеся жизни).
- Ограничение частоты: часть эндпоинтов (`/auth/forgot-password`,
  `/auth/reset-password`) отвечает `429` при превышении лимита.

## Аутентификация (`/auth`)

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/auth/register` | Регистрация по email и паролю, выдаёт пару токенов |
| POST | `/auth/login` | Вход, выдаёт пару токенов |
| POST | `/auth/refresh` | Обмен refresh-токена на новую пару |
| POST | `/auth/logout` | Отзывает refresh-токен |
| GET | `/auth/me` | Текущий пользователь по access-токену |
| POST | `/auth/forgot-password` | Письмо со ссылкой сброса (Resend). Ответ одинаковый для существующего и несуществующего email |
| POST | `/auth/reset-password` | Сброс пароля по токену; одноразовый, отзывает все refresh-токены |

## Пользователь (`/user`)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/user/me` | Профиль: имя, email, гемы, XP, уровень, стрик, жизни, лига, цель дня |
| PATCH | `/user/me` | Изменить имя и/или цель дня (`daily_goal` 1..500). Пустой запрос — `422` |
| POST | `/user/onboard` | Завершить онбординг: имя, цель, кодекс |
| DELETE | `/user/me` | **Удаление аккаунта.** Тело `{"password": "..."}`; неверный пароль — `403` |
| POST | `/user/bear/pet` | Погладить мишку |

`DELETE /user/me` перед удалением отключает автоплатежи и отменяет
незавершённые платежи. Ответ:

```json
{
  "deleted": true,
  "email": "user@example.com",
  "leftover_rows": 0,
  "had_subscription": true,
  "autopayment_stopped": true,
  "canceled_payments": 1
}
```

`autopayment_stopped: false` при `had_subscription: true` означает, что шлюз не
подтвердил отмену, — клиент обязан сказать об этом пользователю (подробности в
`docs/account-deletion.md`).

## Учёба (`/lexbear`, `/content`)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/lexbear/learn` | Карта обучения: юниты, уроки, прогресс |
| GET | `/lexbear/lessons/{lesson_id}` | Урок с вопросами. При нуле жизней — `409` |
| POST | `/lexbear/lessons/{lesson_id}/complete` | Завершить урок: ответы, XP, гемы, стрик. При нуле жизней — `409` |
| GET | `/lexbear/cases` | Список кейсов |
| GET | `/lexbear/cases/{case_id}` | Кейс с вариантами и разбором |
| GET | `/lexbear/articles` | Свод статей с флагом «изучено» |
| GET | `/content/branches` | Ветки контента (legacy) |
| GET | `/content/branches/{branch_id}/lessons` | Уроки ветки |
| GET | `/content/lessons/{lesson_id}` | Урок |
| GET | `/content/lessons/{lesson_id}/cases` | Кейсы урока |

Ответ `409` при исчерпанном запасе жизней:

```json
{
  "detail": {
    "code": "no_lives",
    "message": "Жизни закончились. Новая восстановится через 12 минут.",
    "lives": {
      "lives": 0,
      "max_lives": 5,
      "next_life_in_seconds": 720,
      "regen_minutes": 20
    }
  }
}
```

## Практика и повторения (`/progress`, `/srs`, `/learning`)

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/progress/answer` | Ответ на кейс: пишет попытку, обновляет SM-2 |
| GET | `/progress` | Сводный прогресс |
| POST | `/progress/complete` | Завершить урок (legacy-путь) |
| GET | `/srs/reviews` | Кейсы, срок повторения которых наступил |
| GET | `/learning/next` | Следующий адаптивный кейс; `null`, если показывать нечего |
| POST | `/learning/attempts` | Записать попытку |
| GET | `/learning/progress` | Компетенции: освоение и уверенность |
| POST | `/learning/assessment/start` | Начать диагностику |
| GET | `/learning/assessment/next` | Следующий вопрос диагностики |
| POST | `/learning/assessment/answer` | Ответить на вопрос диагностики |

Пользователю показываются **только кейсы со статусом `approved`**. Гейт
действует на **всех** путях к кейсам, а не только в адаптивной ленте:

| Путь | Как применяется гейт |
|---|---|
| `/learning/next`, `/learning/assessment/*` | Фильтр по `review_status` в запросе банка |
| `/lexbear/cases`, `/lexbear/cases/{id}` | Связь `cases.slug` → `CaseVersion.source_slug` |
| `POST /progress/answer` | Тот же гейт: ответ на скрытый кейс → `404` |
| `GET /srs/reviews` | Скрытый кейс не попадает в повторения |
| `DELETE /admin/content/cases/{slug}?hard=false` | Версии в банке переводятся в `retired` |

Legacy-таблица `cases` поля статуса проверки не имеет, поэтому видимость
определяется связью по slug. Без этого вкладка «Кейсы» обходила проверку:
список отдавал 100 непроверенных кейсов при 4 одобренных в банке, а
`POST /progress/answer` возвращал правильный ответ и разбор со ссылкой на норму
по id любого кейса.

Импорт из паков и админки ставит `imported` — то есть «загружено, но юристом не
проверено», и такой кейс не попадает ни в `/learning/next`, ни в диагностику.
Сразу после `reload-adaptive` лента поэтому пуста, пока кейсы не проверены:
`GET /admin/content/adaptive/review/summary` показывает
`visible_to_users` и `hidden_by_review`. Эталонный стартовый кейс из сида
создаётся уже проверенным.

### Пустая лента: почему именно

`null` от `/learning/next` означает две разные вещи, и клиент обязан их
различать: «всё пройдено» и «показывать нечего». Второе — не достижение
пользователя, а незакрытая работа редакции, и поздравлять с ним нельзя.

Причина приходит в заголовке ответа (тело остаётся `null` по контракту):

| `X-Learning-Unavailable` | Значение |
|---|---|
| `no_content` | В банке нет опубликованных кейсов вовсе |
| `awaiting_review` | Кейсы есть, но ни один не прошёл юридическую проверку |
| отсутствует | Кейсов, доступных пользователю, нет — они пройдены |

Заголовок разрешён в CORS (`expose_headers`), иначе браузерный клиент его не
увидит. Диагностика отдаёт ту же причину полем `unavailable_reason` в
`POST /learning/assessment/start` (`{"session_id": ..., "case": null,
"unavailable_reason": "awaiting_review"}`).

## Геймификация (`/gamification`)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/gamification/me` | XP, уровень, стрик, гемы, жизни, заморозки, достижения |
| POST | `/gamification/add-xp` | Начислить XP |
| GET | `/gamification/daily-goal` | Прогресс цели дня: `goal / done / remaining / completed` |
| GET | `/gamification/leaderboard?limit=30` | Таблица лиги |
| GET | `/gamification/achievements` | Достижения |
| POST | `/gamification/shop/purchase` | Покупка за гемы (`life_refill`, `chest_xp`, `streak_freeze`, `outfit_*`) |
| POST | `/gamification/lives/regenerate` | Доначислить жизни, накопившиеся по таймеру (идемпотентно) |

`GET /gamification/me`:

```json
{
  "xp": 120, "level": 2, "streak": 3, "gems": 45,
  "lives": 4, "max_lives": 5,
  "next_life_in_seconds": 900, "regen_minutes": 20,
  "streak_freezes": 1,
  "next_level_xp": 200,
  "achievements": []
}
```

Жизни: максимум 5, одна восстанавливается за 20 минут от момента траты. Урок
начинается только при `lives > 0`; за неверный ответ урок списывает одну жизнь.

## Платежи (`/payments`)

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/payments/create-payment` | Создать платёж (`monthly`, `yearly`, `gems_500`, `gems_1200`, `gems_3000`) |
| GET | `/payments/premium-status` | Активна ли подписка |
| GET | `/payments/subscriptions` | Подписки пользователя |
| POST | `/payments/webhook` | Уведомление шлюза (без пользовательского токена) |

`create-payment` возвращает `checkout_configured`. Если он `false` (заглушка
`ManualProvider` без ключей), приложение не открывает ссылку, а честно пишет,
что шлюз не подключён. При отказе шлюза — `400` с текстом «деньги не списаны».

Активный провайдер задаётся `PAYMENT_PROVIDER`. Реализованы `manual` (заглушка)
и `yookassa`; добавление нового — `app/modules/payments/providers/`.

## Уведомления (`/notifications`)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/notifications` | Список уведомлений |
| POST | `/notifications/push-token` | Зарегистрировать токен устройства |
| GET | `/notifications/settings` | Переключатели типов напоминаний |
| PATCH | `/notifications/settings` | Включить/выключить тип |
| POST | `/notifications/test` | Тестовый push на свои устройства |

## Маскот и аналитика

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/mascot/phrases`, `/mascot/phrase/{trigger}` | Фразы мишки |
| POST | `/mascot/pet`, GET `/mascot/pet-count` | Поглаживания |
| POST | `/analytics/track` | Событие продуктовой аналитики |

## Служебные (`/admin`, `/health`)

Требуют заголовок `X-Admin-Token` (значение — `ADMIN_TOKEN`); в production без
токена недоступны.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/health` | Проверка живости и доступности БД |
| POST | `/lexbear/seed` | Сид контента |
| GET/PUT | `/admin/content/cases` | Список кейсов / upsert кейса по `slug` |
| DELETE | `/admin/content/cases/{slug}` | Удаление: `?hard=false` — мягкое (`is_active=false` + версии в банке → `retired`), иначе физическое |
| GET/PUT/DELETE | `/admin/content/units`, `/admin/content/units/{unit_code}/lessons` | Юниты и уроки |
| GET | `/admin/content/lessons` | Уроки (список) |
| DELETE | `/admin/content/lessons/{slug}` | Мягкое удаление урока |
| GET | `/admin/content/adaptive/review` | Очередь юридической проверки (`?review_status=imported`) |
| GET | `/admin/content/adaptive/review/summary` | Сколько кейсов видит пользователь (`visible_to_users`) и почему остальные скрыты |
| POST | `/admin/content/adaptive/review/{slug}` | Поставить статус `in_review` / `approved` (фиксирует кто и когда) |
| POST | `/admin/content/reload`, `/admin/content/reload-adaptive` | Перечитать контент |
| POST | `/admin/content/notifications/dispatch` | Рассылка напоминаний (`dry_run` для проверки) |
| GET | `/admin/ui` | Простая админ-страница |

## Коды ответов

| Код | Когда |
|---|---|
| 200 / 201 | Успех |
| 400 | Некорректный запрос (план, товар, токен сброса, вариант ответа от другого кейса) |
| 401 | Нет или истёк access-токен |
| 403 | Неверный пароль при удалении аккаунта; админ-эндпоинт без токена |
| 404 | Объект не найден (в том числе кейс, снятый с показа) |
| 409 | Кончились жизни (`code: "no_lives"`), недостаточно гемов |
| 422 | Ошибка валидации тела запроса; недопустимый `review_status` (перечисляет допустимые); у кейса не ровно один правильный вариант |
| 429 | Превышен лимит запросов (сброс пароля) |
| 503 | Не настроен приём webhook платёжного шлюза |
