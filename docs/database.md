# База данных

PostgreSQL 15+, драйвер `asyncpg`, ORM — SQLAlchemy 2.0 (async, стиль
`Mapped[...]`), миграции — Alembic (`backend/migrations/versions`, 0001–0024).

Типы: `UUID` (Postgres-диалект) для пользовательских и «современных» сущностей,
`INTEGER` — для контента, который импортируется из JSON-паков и исторически
адресуется по числовому id (`units`, `lexbear_lessons`, `questions`,
`articles`). Время везде `TIMESTAMPTZ`.

## Корень: `users`

Строка пользователя — корень дерева владения. У всех пользовательских таблиц
внешний ключ `user_id UUID REFERENCES users(id) ON DELETE CASCADE`.

| Группа | Поля |
|---|---|
| Идентификация | `id`, `email` (unique), `username`, `hashed_password`, `is_active` |
| Профиль | `name`, `daily_goal` (XP в день), `onboarded`, `league` |
| Прогресс | `xp`, `level`, `streak`, `last_active_day`, `gems` |
| Жизни | `lives` (0..5), `lives_updated_at` — метка регенерации |
| Мишка | `bear_mood`, `bear_hunger`, `bear_level`, `bear_outfit` (JSON) |
| Служебное | `created_at` |

Расширяемые «мелочи» (косметика, заморозки стрика) живут в `bear_outfit` (JSON):
`{"top_hat": true, "streak_freezes": 2}`. Так обошлись без миграции на каждый
новый товар; ключи `outfit_*` и `streak_freezes` не конфликтуют.

`lives_updated_at` — nullable: `NULL` означает «запас был полным, отсчёт не
идёт». Метка ставится только при трате из полного запаса, иначе остаток
времени до следующей жизни сгорал бы при каждой ошибке.

## Контент (legacy-путь)

Питает `/lexbear/*` и экраны «Учёба» / «Кейсы».

```
units (code unique)
  └── lexbear_lessons (slug unique, unit_id, xp_reward, is_active)
        ├── theory_cards  (order, title, definition, practical, chips JSON, bear_line)
        └── questions     (order, kind, prompt, case_text, options JSON, correct JSON, explanation)

articles (code unique: codex + number)
  └── learned_articles (user_id, article_id) — unique(user_id, article_id)

branches → lessons → cases → case_options      (старая модель, совместимость)
```

`questions.correct` — полиморфное поле: число (одиночный выбор), список чисел
(множественный) или булево (true/false). Приведение к списку индексов —
единственное место, `content/lexbear_scoring.py`; ни клиент, ни другие модули
не сравнивают ответы сами.

`questions.kind`: `choice` | `multi` | `true_false` | `case`.

`cases` (вкладка «Кейсы») дополнительно имеет `slug` (unique), `codex`,
`difficulty`, `case_text`, `hint`, `featured`, `is_active` — кейсы импортируются
из `cases.json` и имеют разбор.

## Адаптивный банк

Питает `/learning/*`: диагностику, «следующий кейс», компетенции.

```
learning_domains (slug unique)
  └── learning_topics (slug unique в домене)
        └── learning_competencies (slug unique в теме, importance)
              ├── learning_competency_prerequisites (competency_id, prerequisite_id)
              └── learning_case_competencies (case_version_id, competency_id, weight)

learning_cases (title, status)
  └── learning_case_versions (case_id + version unique, difficulty, status,
        review_status, reviewed_by, reviewed_at, source_slug unique)
        ├── learning_case_steps (position, prompt)
        │     └── learning_case_answers (text, is_correct, explanation, error_type)
        └── learning_case_competencies

learning_attempts (user_id, case_version_id, step_id, answer_id,
                   assessment_session_id, correct, time_spent_seconds, hints_used)
learning_assessment_sessions (user_id, completed)
learning_user_competency_states (user_id + competency_id unique,
                                 mastery, confidence, attempts, correct_count,
                                 last_seen, next_review)
```

`source_slug` — ключ идемпотентного импорта: повторный `reload-adaptive`
обновляет версию, а не создаёт дубль. `review_status` (`imported` →
`in_review` → `approved`) — состояние юридической проверки; импорт её не
проставляет.

`learning_user_competency_states.next_review` индексировано: по нему строится
«что подтянуть».

## Прогресс и повторения

| Таблица | Уникальность | Смысл |
|---|---|---|
| `lexbear_progress` | `(user_id, lesson_id)` | `completed`, `best_score`, `attempts`, `crowns` |
| `progress` | `(user_id, lesson_id)` | то же для legacy-уроков |
| `review_states` | `(user_id, case_id)` | параметры SM-2: `repetitions`, `interval_days`, `ease_factor`, `due_at` |
| `review_logs` | — | история каждого повторения (аудит алгоритма) |
| `daily_xp` | `(user_id, day)` | XP за день — питает цель дня |

`daily_xp.day` — дата (начало UTC-суток). Инкремент происходит внутри
`add_xp`, поэтому любой источник XP автоматически учитывается в цели дня.

SM-2 (`srs/sm2.py`) — чистая функция без БД: `quality 0..5` → новые
`repetitions / interval_days / ease_factor` (`MIN_EASE_FACTOR = 1.3`).
Верный ответ в приложении даёт `quality = 5`, неверный — `2`: сброс
повторений, интервал 1 день.

## Геймификация

Достижения — отдельной таблицей: `user_achievements (user_id, code)`, код
уникален в рамках пользователя (идемпотентность выдачи).

| Код | Когда выдаётся |
|---|---|
| `first_lesson` | первый завершённый урок |
| `perfect_lesson` | урок без ошибок |
| `streak_N` | серия дней (вехи) |
| `pet_bear` / родственные | взаимодействие с мишкой |

Уровень: `level = xp // 100 + 1`, следующий уровень — `level * 100` XP.
Лиги: `Бронза → Серебро → Золото → Мантия → Фемида` (порядок важен, следующая
считается по индексу).

## Уведомления

```
push_tokens (token unique, platform, is_active)
notification_settings (user_id unique)
notifications (user_id, type, title, body, read)
notification_deliveries (user_id + type + day unique)
```

`notification_deliveries` — гарантия идемпотентности рассылки на уровне БД:
планировщика в проекте нет, запуск идёт из cron, а воркеров два. Повторный
запуск в тот же день видит запись и не шлёт второй раз.

`push_tokens.is_active` гасится, когда Expo отвечает `DeviceNotRegistered`:
мёртвые токены после переустановок копятся и незаметно съедают квоту.

## Платежи

```
payment_history (yookassa_payment_id unique, amount в копейках,
                 currency, status, description "kind:plan", paid_at)

subscriptions (status active|canceled|expired|trial, plan monthly|yearly,
               yookassa_payment_id, payment_method_id, auto_renew,
               starts_at, expires_at)
```

`description` хранит `"subscription:monthly"` / `"gems_500"` — по нему
`confirm_payment` понимает, что начислять. Идемпотентность: если
`payment_history.status = succeeded`, повторный webhook ничего не начисляет
(ЮKassa повторяет доставку при сбоях).

`subscriptions.payment_method_id` — сохранённый шлюзом способ оплаты. У ЮKassa
нет API его удаления: отключение автосписаний = удаление идентификатора у себя,
поэтому при отмене подписки и при удалении аккаунта колонка обнуляется.

## Безопасность данных

| Таблица | Что хранится |
|---|---|
| `refresh_tokens` | **sha256-хеш** токена, не сам токен |
| `password_reset_tokens` | **sha256-хеш**, `expires_at`, `used_at` (одноразовый) |
| `users` | bcrypt-хеш пароля |

Дамп базы не даёт ни войти по чужому refresh-токену, ни сбросить пароль по
ссылке из письма. Успешный сброс пароля отзывает все refresh-токены
пользователя.

## Индексы

Кроме `user_id` в каждой пользовательской таблице (это и FK, и фильтр почти
всех запросов), индексировано то, по чему идёт выборка:

- `users.email` (unique), `users.last_active_day`;
- `review_states.due_at`-выборка через `(user_id, case_id)`;
- `payment_history.yookassa_payment_id` (unique), `created_at`;
- `subscriptions.status`, `subscriptions.expires_at` (поиск истекающих);
- `daily_xp (user_id, day)` unique;
- `learning_case_versions.source_slug` (unique), `review_status`, `status`;
- `learning_user_competency_states.next_review`;
- `mascot_phrases.trigger`.

## Миграции

| Диапазон | Содержание |
|---|---|
| 0001–0008 | baseline: auth, контент, маскот, прогресс, геймификация, платежи, уведомления |
| 0009–0012 | поля LexBear, контент, прогресс, `cases.lesson_id` nullable |
| 0013–0015 | индексы производительности, `slug`/`is_active`, подсказка кейса |
| 0016–0018 | адаптивный банк, юридическая проверка, фразы маскота |
| 0019 | хеширование refresh-токенов |
| 0020–0022 | `daily_xp`, `password_reset_tokens`, настройки и доставки уведомлений |
| 0023 | `users.lives_updated_at` (регенерация жизней) |
| 0024 | `subscriptions.payment_method_id`, `auto_renew` |

Правила:

- `default=` в `mapped_column` применяется **только при INSERT**. До `flush`
  поле `None`, поэтому в сервисах числовые поля задаются явно, а модели с
  важными дефолтами имеют `__init__` (`NotificationSettings`, `Subscription`).
  На этом уже дважды ловились баги (`None + 1` в SM-2, «все напоминания
  отключены»).
- На sqlite `alembic upgrade head` не проходит (миграция 0005 использует
  Postgres-специфику). Миграции проверяются отдельно — через
  `MigrationContext` + `Operations` на чистой таблице; тесты поднимают схему
  через `Base.metadata.create_all`.
- Каскады: `ON DELETE CASCADE` объявлен в Postgres, а в sqlite выключен по
  умолчанию. Поэтому `delete_account` дополнительно «подметает» строки по
  моделям — иначе тесты проходили бы, а прод-поведение отличалось.
