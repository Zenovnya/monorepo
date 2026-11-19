# База данных

PostgreSQL 15+, драйвер `asyncpg`, ORM — SQLAlchemy 2.0 (async, стиль
`Mapped[...]`), миграции — Alembic (`backend/migrations/versions`, 0001–0026).

Типы: `UUID` (Postgres-диалект) для пользовательских сущностей, `INTEGER` — для
счётчиков и порядка, `VARCHAR` — для идентификаторов карточек из пака
(`CIV01_R1`). Время везде `TIMESTAMPTZ`.

**Таблиц контента нет.** Прежние `units`, `lexbear_lessons`, `questions`,
`theory_cards`, `articles`, `branches`, `lessons`, `cases` и 12 таблиц
`learning_*` удалены миграцией 0026: контент поставляется файлом
`app/content_packs/themes.json` и версионируется целиком. Прогресс по старым
урокам (`progress`, `lexbear_progress`) и повторения (`review_states`,
`review_logs`) удалены вместе с ними.

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

## Адаптивное обучение

Состояние отбора кейсов. Контент сюда не копируется — только ссылки на него.

```
adaptive_states (user_id unique)
  seq                  — монотонный счётчик событий пользователя
  open_attempt_id      — открытая попытка (не больше одной), строка 'a{seq}'
  release_key          — pack_id@version, под которым шло обучение
  weights (JSON)       — веса тем 80–120 %, версия в weights_version

adaptive_attempts (id 'a{seq}')
  user_id, item_id, lesson_id, topic_id, subtopic_id, evidence_family_id,
  content_version, mode, origin, issued_seq, terminal_seq,
  preexposed, assisted, status, counted, reason, selected_option_id, correct

adaptive_observations (attempt_id unique)
  seq, topic_id, subtopic_id, item_id, evidence_family_id, content_version,
  correct, voided

adaptive_seen_families (user_id + family_id unique)
adaptive_topic_priorities (user_id + topic_id unique)
  n, errors, need, priority, state — снимок для экрана прогресса
```

Почему именно так:

- **`seq`, а не `created_at`.** По `seq` упорядочены наблюдения и определяется
  «какая попытка была позже». Два ответа в одну секунду сортировались бы по
  времени произвольно, и окно «последних пяти» зависело бы от удачи.
- **Строки вместо внешних ключей на контент.** Пак версионируется целиком:
  после обновления карточки с тем же id может уже не быть. Вместе с id
  хранятся `content_version` и `release_key`, поэтому старое наблюдение
  остаётся осмысленным.
- **`voided`, а не удаление.** Спорное наблюдение (ошибка в ключе, правка
  редакции) нужно видеть, но не учитывать в окне. История не переписывается.
- **`adaptive_seen_families` отдельно от попыток.** Семья заданий считается
  показанной в момент выдачи, даже если карточку закрыли пропуском. Иначе
  пропуск «возвращал» бы кейс в пул свежих.

Правила отбора — `docs/adaptive-engine.md`. `ON DELETE CASCADE` от `users`
есть у всех пяти таблиц: состояние обучения — персональные данные и уходит
вместе с аккаунтом.

## Прогресс и цель дня

| Таблица | Уникальность | Смысл |
|---|---|---|
| `daily_xp` | `(user_id, day)` | XP за день — питает цель дня |

`daily_xp.day` — начало UTC-суток. Инкремент происходит внутри `add_xp`,
поэтому любой источник XP автоматически учитывается в цели дня. Это
единственная таблица прогресса, оставшаяся после удаления старого контента:
она не привязана к урокам.

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
- `payment_history.yookassa_payment_id` (unique), `created_at`;
- `subscriptions.status`, `subscriptions.expires_at` (поиск истекающих);
- `daily_xp (user_id, day)` unique;
- `adaptive_attempts.item_id`, `adaptive_attempts.topic_id` — по ним идёт
  поиск «что уже показывали» и «последняя попытка по карточке»;
- `adaptive_observations.topic_id` — окно темы;
- `adaptive_seen_families (user_id, family_id)` unique — проверка «свежая ли
  семья» на каждом выборе;
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
| 0025 | состояние адаптивного обучения: `adaptive_states`, `adaptive_attempts`, `adaptive_observations`, `adaptive_seen_families`, `adaptive_topic_priorities` |
| 0026 | удаление старого контента и прогресса по нему (26 таблиц) |

Правила:

- `default=` в `mapped_column` применяется **только при INSERT**. До `flush`
  поле `None`, поэтому в сервисах числовые поля задаются явно, а модели с
  важными дефолтами имеют `__init__` (`NotificationSettings`, `Subscription`).
  На этом уже дважды ловились баги (`None + 1` в SM-2, «все напоминания
  отключены»).
- На sqlite `alembic upgrade head` не проходит (0005 и 0026 используют
  Postgres-специфику). Миграции прогоняются в CI на настоящем Postgres, а
  тесты поднимают схему через `Base.metadata.create_all`. Поэтому ошибки,
  которые видит только Postgres, локально не воспроизводятся — их нужно
  ловить тестом по тексту миграции.
- `ON DELETE CASCADE` управляет удалением **строк**, а `DROP TABLE` требует,
  чтобы на таблицу не ссылался ни один внешний ключ. Порядок в 0026
  проверяется тестом `test_drop_order_respects_foreign_keys`: он строит граф
  зависимостей из миграций 0001–0024. Первая версия 0026 удаляла `cases`
  раньше ссылающихся на неё таблиц и падала именно в CI.
- Каскады: `ON DELETE CASCADE` объявлен в Postgres, а в sqlite выключен по
  умолчанию. Поэтому `delete_account` дополнительно «подметает» строки по
  моделям — иначе тесты проходили бы, а прод-поведение отличалось.
