# Архитектура

Один backend (FastAPI) + одно мобильное приложение (Expo) + веб-админка.
Разделение не по «слоям», а по **доменным модулям**: каждый модуль в
`backend/app/modules/*` владеет своими таблицами, схемами, сервисом и роутами.

## Общая картина

```
                    ┌──────────────────────────┐
   Expo (iOS/Android/Web)  ──HTTPS──▶  FastAPI  ──▶ PostgreSQL (asyncpg)
   React Navigation,       │            │  │
   TanStack Query,         │            │  └──▶ Redis (кэш, rate-limit)
   Zustand, Reanimated     │            │
                           │            └──▶ Expo Push API, Resend, ЮKassa
                    admin/ (веб-админка) ──▶ /admin/content/*
```

- **Backend** — единственный источник правды. Клиент не считает ни результаты
  урока, ни остаток жизней: он присылает ответы, сервер сверяет с эталоном из
  БД и возвращает награды.
- **Mobile** — «тонкий» клиент с оптимистичным UI: локальные счётчики (жизни в
  уроке, выбранный вариант) существуют только чтобы не ждать сеть на каждый
  тап, и синхронизируются с сервером при первой возможности.
- **Admin** — статические файлы из `admin/`, отдаются роутом `/admin/ui`;
  работают через те же `/admin/content/*` с заголовком `X-Admin-Token`.

## Backend

### Точка входа и порядок middleware

`app/main.py` собирает приложение:

1. `GZipMiddleware` (порог 500 байт: список кейсов — ~94 КБ JSON);
2. `CORSMiddleware` — только явный allowlist `CORS_ORIGINS` плюс
   опциональный `CORS_ORIGIN_REGEX` для LAN-адресов Expo;
3. `GlobalRateLimitMiddleware` — `RATE_LIMIT_MAX` запросов за
   `RATE_LIMIT_WINDOW` секунд с одного IP (состояние в Redis с откатом в память
   процесса, см. `app/ratelimit.py`);
4. `SentryAsgiMiddleware`, если задан `SENTRY_DSN`.

Порядок важен: CORS стоит **до** rate-limit, иначе ответ `429` приходил бы без
заголовков CORS, и браузер показывал бы «Network Error» вместо понятного
«слишком много запросов». У обработчика непредвиденных исключений заголовки
CORS выставляются вручную по той же причине.

`/health` проверяет БД настоящим `SELECT 1` — на бесплатном Supabase это ещё и
«пробуждение» спящей базы.

Интерактивная документация (`/docs`, `/openapi.json`) включается только при
`DEBUG=true`: в проде структура API не раскрывается.

### Модули

| Модуль | Что владеет | Ключевые файлы |
|---|---|---|
| `auth` | `users`, `refresh_tokens`, `user_achievements`, `password_reset_tokens` | `service.py` (JWT, bcrypt, сброс пароля) |
| `user` | профиль, онбординг, удаление аккаунта | `service.py` (`delete_account`) |
| `adaptive` | отбор кейсов: `adaptive_states`, `adaptive_attempts`, `adaptive_observations`, `adaptive_seen_families`, `adaptive_topic_priorities` | `engine.py` (правила), `service.py` (БД), `pack.py` (контент) |
| `content` | проверка ввода и сверка ответа (таблиц нет) | `validation.py`, `scoring.py` |
| `progress` | `daily_xp` (ежедневная цель) | `models.py` |
| `gamification` | XP, уровни, стрик, гемы, жизни, лиги, магазин | `service.py` |
| `notifications` | `notifications`, `push_tokens`, `notification_settings`, `notification_deliveries` | `service.py`, `app/push.py` |
| `payments` | `subscriptions`, `payment_history` | `service.py`, `providers/` |
| `mascot` | `mascot_phrases`, `user_mascot_state` | `service.py` |
| `admin` | CRUD контента, очередь юрпроверки, рассылка | `routes.py` |
| `analytics` | приём событий воронки | `routes.py` |
| `storage` | S3-совместимое хранилище (boto3) | — |

Таблица `users` — корень: у 20+ таблиц `ON DELETE CASCADE` на `user_id`.
Поэтому удаление аккаунта — один `DELETE` пользователя плюс «подметание»
строк по метаданным моделей (см. `docs/account-deletion.md`).

### Сквозные механизмы

**Кэш** (`app/cache.py`). Redis с обязательными короткими таймаутами
(`connect 0.25 с`, `socket 0.5 с`): если Redis недоступен, кэш просто
выключается за доли секунды, и приложение работает как без него. Никогда не
бросает наружу.

- состояние геймификации — ключ `gamification:{user_id}`, инвалидируется любым
  начислением XP/покупкой;
- разбор урока в новом движке **не кэшируется**: урок собирается из пака в
  памяти (словарь на 30 элементов), а Redis-кэш остался только у
  геймификации. Кэшировать тут нечего — лишний ключ означал бы ещё одно место,
  где контент может устареть.

**Rate limit** (`app/ratelimit.py`). Скользящее окно по IP; `TRUST_PROXY_HEADERS`
включает чтение `X-Forwarded-For` — по умолчанию выключено, иначе заголовок
подделывается при прямом доступе. Отдельные жёсткие лимиты у
`/auth/forgot-password` (3 / 5 мин) и `/auth/reset-password` (10 / 5 мин):
письма стоят денег и годятся для спама чужому адресу.

**Фоновые интеграции — «не роняем бизнес-операцию».** `app/push.py`
(Expo Push API), `app/email_service.py` (Resend), провайдеры платежей: сетевые
ошибки логируются и попадают в отчёт, но не превращаются в `500`. Причина
практическая: урок не должен падать из-за того, что Expo не ответил.

**Ошибки для людей.** Все `HTTPException` несут русский `detail`. Где клиенту
нужны данные, а не текст, `detail` — объект: `409 {"code": "no_lives",
"message": ..., "lives": {...}}`. Клиент превращает это в человеческий текст
через `describeLoadError` (`mobile/src/api/client.js`).

### Контент как данные

Контент — **один файл**: `backend/app/content_packs/themes.json` (6 тем,
30 уроков, 90 карточек, 72 нормы). Других паков и таблиц контента нет:
прежние `curriculum.json` / `cases.json` / `articles.json` и таблицы
`branches`/`lessons`/`cases`/`lexbear_*`/`learning_*` удалены миграцией 0026
вместе с прогрессом по ним.

Почему файл, а не таблицы: пак версионируется целиком (`pack_id@version`).
Копия контента в БД неизбежно разъехалась бы с файлом — часть правок попала бы
в базу, часть в файл, и никто не смог бы сказать, какая из них настоящая.

```
themes.json ──validate()──▶ отказ при битом паке
     │
     ├── engine.choose()  ──▶ какой кейс показать (docs/adaptive-engine.md)
     └── engine.public_item() ──▶ карточка без ключа и разбора
```

Импорт ≠ юридическая проверка. Статус карточки (`legal_review_status`) живёт в
файле, и гейт стоит на импорте и на выдаче:

- `pack.validate()` не принимает пак, где `approved` стоит без
  `expert_signoff_id` и `expert_approved_on` (`MISSING_SIGNOFF`);
- `engine.available()` пускает карточку, только если допустимы и она, и её
  урок; `retired`/`needs_recheck` не показываются никогда, черновики — только
  с админ-токеном (`sandbox`);
- отзыв карточки закрывает открытую попытку без зачёта.

Текущее состояние: пак опубликован **решением владельца без юридической
проверки** (`expert_signoff_id = owner-approval-no-legal-review`), пометка об
этом лежит в паке (`editorial_note`) и показывается в приложении. Подробнее —
`docs/legal-content-policy.md`.

Состояние обучения (попытки, наблюдения, показанные семьи, приоритеты тем) —
в таблицах `adaptive_*`, см. `docs/adaptive-engine.md`.

### Платежи

`PaymentProvider` (`providers/base.py`) — два обязательных метода
(`create_checkout`, `parse_webhook`) и один необязательный
(`cancel_payment`). Начисление Premium и гемов — общий
`service.confirm_payment`, поэтому новый шлюз не требует правок бизнес-логики.
Реализованы `manual` (заглушка, реальных денег не берёт) и `yookassa`.
Выбор — `PAYMENT_PROVIDER`; неизвестное значение безопасно откатывается на
заглушку.

## Mobile

### Слои

```
src/api/*        — тонкие обёртки над axios (по домену, как модули backend)
src/store/       — Zustand: сессия и пользователь (единственный источник правды о токенах)
src/hooks/*      — useAuth, usePremium, useMascot, useReducedMotion
src/components/* — визуальный язык (хохлома, анимации, состояния экранов)
src/screens/*    — экраны
src/navigation/* — стек + табы, deep links
```

**Данные** — TanStack Query. Ключи фиксированные (`gamification-me`,
`adaptive-overview`, `adaptive-next`, `adaptive-lesson`, …), и после мутации
инвалидируется именно тот ключ, который читают другие экраны. Показательный
случай: жизни читаются в шапке (`TopStats`), в уроке и на экране `NoLives` —
все через `gamification-me`, поэтому любое списание обновляет шапку.

**Сессия** — Zustand + платформенное хранилище (`tokenStorage`). `refresh`
реализован отдельным `fetch`, а не через `apiClient`: иначе получался цикл
`client -> store -> client`, из-за которого окно авторизации видело
неинициализированные значения. При `401` клиент один раз обновляет токен и
повторяет запрос.

**Анимации** — Reanimated на UI-потоке (`PressableScale`, `AnimatedSwitch`,
`AnimatedButton`, `TabBarIcon`, `FadeInView`), длительности — в
`theme/motion.js`. Везде уважается системная настройка «уменьшить движение»
(`useReducedMotion`): длительности обнуляются, но действия остаются доступны.

**Состояния экрана** — один набор (`components/StateViews.js`):
`LoadingState`, `ErrorState` (с `describeLoadError` и «Повторить»),
`EmptyState`. Причина: до него часть экранов не обрабатывала ошибку вообще
(«Изучено: 0 из 0») или выдавала её за пустой результат.

**Сеть.** `OfflineBanner` показывает потерю связи, Query с
`refetchOnReconnect` сама перезапрашивает данные, когда сеть вернулась.

## Поток одного урока

```
LearnScreen ──GET /adaptive/overview──▶ 6 тем, уроки, приоритет практики
     │ тап по уроку
     ▼
LessonScreen ──GET /adaptive/lessons/{id}──▶ теория, шаги, нормы
     │ «Пройти проверку»
     ▼
POST /adaptive/attempts {item_id, mode: check, origin: lesson}
     │   сервер: открывает попытку, возвращает карточку без ключа
     │ ответ (или подсказка / пропуск / разбор)
     ▼
POST /adaptive/attempts/{attempt_id}/actions
     │   сервер: сверяет option_id с ключом, решает засчитывать ли,
     │   возвращает ключ, разбор и нормы; при зачёте пишет наблюдение
     ▼
инвалидация adaptive-overview → приоритет темы пересчитан
```

Рекомендованный кейс — та же ручка с `GET /adaptive/next`: сервер сам
выбирает тему и карточку, а клиент не может назначить себе засчитываемую
попытку.

## Что осознанно не сделано

- **Нет очереди задач.** Рассылка напоминаний запускается извне (cron или
  `POST /admin/content/notifications/dispatch`); идемпотентность обеспечивает
  таблица `notification_deliveries` с уникальным индексом
  `(user_id, type, day)`, а не планировщик в процессе.
- **Нет WebSocket.** Всё, что «живое» (таймер жизней, статус оплаты), сделано
  опросом разумной частоты.
- **Нет горизонтального шаринга состояния**, кроме Redis: сессии stateless,
  JWT проверяется локально.
