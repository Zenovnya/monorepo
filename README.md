# Лапа Закона (LexBear)

Мобильный EdTech-продукт по праву: короткие уроки, интерактивные кейсы и
мишка-юрист, который объясняет разбор.

| Часть | Стек | Где лежит |
|-------|------|-----------|
| `backend` | FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL | [`backend/`](backend) |
| `mobile` | Expo 54, React Native 0.81, React Navigation, TanStack Query, Zustand, Reanimated | [`mobile/`](mobile) |
| `admin` | Веб-админка контента (`/admin/ui`) | [`admin/`](admin) |
| `infra` | Docker Compose, Railway, Supabase | [`infra/`](infra) |

Документация: [`docs/product.md`](docs/product.md), [`docs/architecture.md`](docs/architecture.md),
[`docs/api.md`](docs/api.md), [`docs/mvp-plan.md`](docs/mvp-plan.md), [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Быстрый старт (backend)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows;  source .venv/bin/activate — macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # подставьте DATABASE_URL / JWT_SECRET_KEY
```

### Вариант A — PostgreSQL через Docker Compose

```bash
cd infra/docker
cp .env.example .env            # POSTGRES_PASSWORD, JWT_SECRET_KEY (>=32 символов), ADMIN_TOKEN
docker compose up -d --build    # backend сам выполнит alembic upgrade head
curl http://localhost:8000/health
```

Разово загрузить контент из JSON-паков:

```bash
curl -X POST http://localhost:8000/lexbear/seed -H "X-Admin-Token: <ADMIN_TOKEN>"
# полная перезагрузка + импорт кейсов в адаптивный банк:
curl -X POST "http://localhost:8000/admin/content/reload?prune=true" -H "X-Admin-Token: <ADMIN_TOKEN>"
curl -X POST "http://localhost:8000/admin/content/reload-adaptive" -H "X-Admin-Token: <ADMIN_TOKEN>"
```

### Вариант B — локальный backend против своего Postgres

```bash
cd backend
alembic upgrade head
python -m app.seed              # стартовый кейс + импорт кейсов из паков
python -m uvicorn app.main:app --reload --port 8000
```

Тесты и линт:

```bash
cd backend
python -m pytest                # DB-тесты пропускаются, если DATABASE_URL недоступен
python -m ruff check app tests
```

> `JWT_SECRET_KEY` обязателен: при `DEBUG=false` приложение не стартует, если
> секрет короче 32 символов.

---

## Быстрый старт (mobile)

```bash
cd mobile
npm install
cp .env.example .env            # EXPO_PUBLIC_API_URL -> ваш backend
npm start                       # "a" — Android, "i" — iOS, "w" — web
npm run lint
```

Адрес API по умолчанию вычисляется автоматически (`src/api/client.js`): на
устройстве берётся хост Metro-сервера с портом `8000`. Android-эмулятор:
`http://10.0.2.2:8000`, iOS-симулятор: `http://localhost:8000`.

Сборка через EAS: [`mobile/EAS_DEPLOY.md`](mobile/EAS_DEPLOY.md), профили — `mobile/eas.json`.

---

## Контент как данные

Контент описан JSON-паками в `backend/app/content_packs/`:

- `curriculum.json` — юниты, уроки, теория, вопросы;
- `cases.json` — кейсы с вариантами и разбором;
- `articles.json` — справочные статьи кодексов.

`content_loader.py` делает идемпотентный upsert в legacy-таблицы (`units`,
`lexbear_lessons`, `cases`). `learning/importer.py` переносит те же кейсы в
адаптивный банк (`learning_cases`, `learning_case_versions`, ...), из которого
работает `GET /learning/next`. Импорт не означает юридическую проверку:
`review_status` остаётся `imported` до `approved` в админке.

---

## Структура

```
backend/            FastAPI-приложение (app/modules/* — доменные модули)
  app/content_packs JSON-паки контента
  migrations/       Alembic (0001-0017)
  tests/            pytest
mobile/             Expo-приложение (src/screens, src/components, src/theme)
admin/              веб-админка
docs/               продукт, архитектура, API, план MVP
infra/              docker / railway / supabase
.github/workflows/  CI
```

## Статус

Актуальный статус и приоритеты до запуска MVP — [`docs/mvp-plan.md`](docs/mvp-plan.md).


