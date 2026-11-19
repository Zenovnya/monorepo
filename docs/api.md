# API Лапы закона (LexBear)

Справочник по HTTP-API бэкенда. Полная машиночитаемая схема — на самом сервисе:
`GET /docs` (Swagger UI) и `GET /openapi.json`.

- Базовый префикс: `/` (модули развешивают свои префиксы: `/auth`, `/user`,
  `/adaptive`, `/gamification`, …).
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

## Контент и адаптивное обучение (`/adaptive`)

Контент поставляется файлом `app/content_packs/themes.json` (6 тем, 30 уроков,
90 карточек, 72 нормы) и проверяется при импорте. Раньше он лежал в таблицах
(`branches`/`lessons`/`cases`/`lexbear_*`) и в JSON-паках; эти таблицы и паки
удалены миграцией 0026.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/adaptive` | Темы и пометка о редакционном статусе контента |
| GET | `/adaptive/next` | Следующий кейс по решению сервера (открывает попытку) |
| GET | `/adaptive/overview` | Прогресс по темам и последние ответы |
| GET | `/adaptive/lessons/{lesson_id}` | Урок: теория, шаги, нормы |
| POST | `/adaptive/attempts` | Открыть повтор уже виденного кейса |
| POST | `/adaptive/attempts/{attempt_id}/actions` | Ответ / подсказка / пропуск / разбор |

### Кто решает, что показать

Клиент **не выбирает** ни карточку, ни режим зачёта. `GET /adaptive/next` сам
вызывает движок отбора и открывает попытку; параметры `topic_id`/`lesson_id`
означают только пожелание пользователя. Ручки «открой эту карточку как свежий
кейс» нет: иначе клиент выдал бы себе засчитанную попытку на уже показанный
разбор, и приоритеты тем перестали бы отражать знания.

`origin=auto` в `POST /adaptive/attempts` отклоняется (`400 BAD_ORIGIN`) —
автоматическую выдачу делает только `/next`.

### Ответ `/adaptive/next`

```json
{
  "choice": {"kind": "new_case", "reason": "THEME_PRIORITY",
             "topic_id": "CIV", "item_id": "CIV01_R1", "origin": "auto"},
  "item": {
    "item_id": "CIV01_R1", "kind": "recommend_case",
    "topic_id": "CIV", "topic_title": "…", "lesson_id": "CIV01", "lesson_title": "…",
    "situation": "…", "question": "…",
    "options": [{"id": "A", "text": "…"}, {"id": "B", "text": "…"}, {"id": "C", "text": "…"}]
  },
  "attempt_id": "a1", "mode": "fresh_case", "origin": "auto"
}
```

Ключа ответа, разбора и ссылок на нормы в карточке **нет** — они приходят
только в результате действия. `kind` в `choice`: `new_case`, `resume`,
`review`, `lesson`, `catalog`, `none`. `review` означает «свежие кейсы темы
закончились, предложен повтор» — попытка при этом не открывается.

### Ответ на действие

```json
{"attempt_id": "a1", "status": "answered", "reason": "COUNTED", "counted": true,
 "correct": true, "correct_option_id": "B",
 "explanation": "…", "legal_basis_ids": ["RU_CONST_40"],
 "options": [{"id": "A", "text": "…", "explanation": "…"}]}
```

`reason` при незачёте: `SKIP`, `REVEAL`, `NOT_ASSESSMENT`, `FAMILY_SEEN`,
`PRACTICE`, `ASSISTED`, `CONTENT_UNAVAILABLE`. Порядок проверки именно такой —
он важен: пропуск объясняется как пропуск, а не как «плохой ответ».
Повторное действие по закрытой попытке возвращает `already_closed: true` и не
меняет исход (две вкладки — выигрывает первая).

`action: "help"` попытку **не закрывает**, но навсегда снимает зачёт и
возвращает `assistance` (подсказку карточки или теорию урока).

### Прогресс по темам

`GET /adaptive/overview` отдаёт по каждой теме: `n` (ответов в окне),
`errors`, `practice_priority` (проценты) и `state`
(`NOT_ASSESSED` / `LIMITED` / `RECENT_RESULTS`).

`practice_priority` — **приоритет полезной практики**, а не вероятность
правильного ответа: `need = (2 + errors) / (4 + n)` по последним пяти
наблюдениям, умноженное на вес темы (80–120%). Пустая тема даёт 50% намеренно:
про неё нет наблюдений.

### Контент и видимость

Пользователю показываются только карточки и уроки со статусом `approved`,
у которых есть подпись и дата. Черновики доступны только с админ-токеном
(`sandbox`), `retired` и `needs_recheck` — никогда. Отзыв карточки закрывает
открытую попытку без зачёта (`CONTENT_UNAVAILABLE`) и не раскрывает ключ.

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
| GET | `/admin/content/pack` | Сводка по опубликованному паку: темы, уроки, карточки, нормы |
| POST | `/admin/content/pack/validate` | Проверить пак теми же правилами, что и импорт |
| GET | `/admin/content/status` | «Контент есть и валиден» для деплой-скриптов |
| GET | `/admin/content/pack/{lesson_id}` | Предпросмотр урока так, как его видит пользователь |
| POST | `/admin/content/validate/case` | Проверить кейс из формы, не записывая: нерешаемый кейс отклоняется |
| POST | `/admin/content/validate/lesson` | Проверить урок с вопросами из формы |
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
| 422 | Ошибка валидации тела запроса; недопустимый `review_status` (перечисляет допустимые); у кейса не ровно один правильный вариант; у вопроса неизвестный `kind` или `correct` вне списка вариантов |
| 429 | Превышен лимит запросов (сброс пароля) |
| 503 | Не настроен приём webhook платёжного шлюза |
