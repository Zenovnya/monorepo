# Локальный запуск и тестирование LexBear

Пошаговое руководство: как поднять весь стек с нуля и проверить, что всё работает.

---

## 0. Что понадобится

| Компонент | Версия | Где взять |
|---|---|---|
| Windows | 10/11 | — |
| PowerShell | 5.1 (встроена) | — |
| Python | 3.12+ | python.org (галочка **Add python.exe to PATH**) |
| PostgreSQL | 14–17 | EDB-установщик; нужен `pg_ctl.exe` |
| Node.js | 18+ (20 LTS ок) | nodejs.org |
| Docker | *не обязателен* | есть `infra/docker/docker-compose.yml` как альтернатива локальному PG |
| Телефон | Expo Go | App Store / Google Play |

Проверка:

```powershell
python --version          # Python 3.12.x
node --version            # v18+
git --version
```

Все команды ниже выполняются **из корня репозитория** (там, где лежит папка `scripts\`).

> **Два кластера PostgreSQL — это норма.** Локальный dev-кластер живёт в `.local\pgdata`
> на порту **5433** и не трогает вашу системную установку на 5432. API слушает **8000**.

---

## 1. Один раз: зависимости бэкенда

```powershell
cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cd ..
```

Создайте `backend\.env` из примера, если его ещё нет:

```powershell
Copy-Item backend\.env.example backend\.env -ErrorAction SilentlyContinue
```

Скрипты сами находят Python в таком порядке: `backend\.venv\Scripts\python.exe` →
`PATH` → лаунчер `py`. Если используете venv — создайте и активируйте его заранее:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cd ..
```

---

## 2. Самый быстрый путь: всё одной командой

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1
```

Что делает скрипт (5 шагов, ~20 с на холодную):

1. `1/5` Проверка зависимостей бэкенда — префлайт-импорт `uvicorn` и `app.main`.
2. `2/5` PostgreSQL — поднимает **dev-кластер** на порту 5433 (создаёт `pgdata`, если надо).
3. `3/5` Alembic-миграции — `alembic upgrade head`.
4. `4/5` API на `0.0.0.0:8000` — фоновый uvicorn, лог в `.local\backend.err.log`.
5. `5/5` Сид контента — идемпотентно, повторный запуск отвечает `{"skipped": true}`.

Полезные флаги:

```powershell
# только бэкенд, без Metro/Expo
powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1 -SkipMobile

# не сидить контент
powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1 -SkipSeed
```

`dev-start.ps1` принимает только `-SkipSeed` и `-SkipMobile` и всегда поднимает
API на порту 8000. Порт настраивается отдельно — у `dev-api.ps1` и `dev-db.ps1`
есть параметр `-Port`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-db.ps1  -Port 5434
powershell -ExecutionPolicy Bypass -File scripts\dev-api.ps1 -Port 8010
```

Внимание: при смене порта API правьте `mobile\.env` и правило firewall вручную.

В конце выводится блок «Готово» со ссылками:

```
API:      http://localhost:8000/docs
Health:   http://localhost:8000/health
С телефона: http://192.168.0.108:8000
```

Если шаг падает — скрипт останавливается и печатает, **что именно** не так (нет `pg_ctl`,
нет зависимостей, упала миграция). Раньше такие ошибки молча пропускались, и вы получали
«пустую карту обучения» или 500-ку при регистрации.

---

## 3. Проверка «глазами» (без телефона)

Откройте в браузере:

- **http://localhost:8000/health** → `{"status":"ok","app":"LexBear API","database":"ok"}`
- **http://localhost:8000/docs** → интерактивный Swagger

Из консоли:

```powershell
Invoke-RestMethod http://localhost:8000/health | ConvertTo-Json
```

Если `database` не `ok` — БД не поднялась, смотрите раздел 8.

---

## 4. Запуск мобильного приложения (Metro/Expo)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-mobile.ps1
```

Скрипт:

- при необходимости делает `npm install` в `mobile\`;
- пишет `mobile\.env` с **реальным LAN-адресом** вашей Wi-Fi/Ethernet-карты
  (виртуальные адаптеры WSL/Hyper-V/VirtualBox пропускаются — раньше именно они
  ломали доступ с телефона);
- запускает `npx expo start --lan --clear`.

Телефон должен быть **в той же Wi-Fi-сети**. Сканируйте QR из Expo Go.

Явно задать адрес API:

```powershell
.\scripts\dev-mobile.ps1 -ApiUrl "http://192.168.0.108:8000"
```

Проверить, какой адрес записан:

```powershell
Get-Content mobile\.env
```

Проверить, что телефон его видит, — откройте в мобильном браузере
`http://<ваш-LAN-IP>:8000/health`. Если не открывается, дело в firewall (раздел 5).

---

## 5. Firewall (если телефон не видит API)

```powershell
# нужно запустить PowerShell от имени администратора
powershell -ExecutionPolicy Bypass -File scripts\open-firewall.ps1
```

Скрипт добавляет входящее правило `LexBear API (8000)`. Проверить:

```powershell
Get-NetFirewallRule -DisplayName "LexBear API (8000)"
```

Если меняли порт API — добавьте правило и для него.

---

## 6. Сид контента вручную (опционально)

Сид встроен в `dev-start.ps1`, но можно вызвать напрямую. Нужен админ-токен:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8000/lexbear/seed `
  -Headers @{ "X-Admin-Token" = "lexbear-admin-dev-token" }
```

Ответы:

- `{"skipped": true}` — контент уже есть (норма при повторном запуске);
- `{"skipped": false, ...}` — контент загружен; в ответе отчёт по пакам.

Проверить, что контент реально в БД:

```powershell
$env:PGPASSWORD='postgres'
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -h 127.0.0.1 -p 5433 -U postgres -d lexbear `
  -c "select (select count(*) from units) as units, (select count(*) from lexbear_lessons) as lessons;"
```

Ожидаемо: `units = 5`, `lessons = 6`.

---

## 7. Сквозной сценарий тестирования приложения

1. Запустите `dev-start.ps1` (раздел 2) — API и БД подняты.
2. Запустите `dev-mobile.ps1` (раздел 4) — Metro отдал QR.
3. В Expo Go откройте приложение на телефоне.
4. **Регистрация:** email вида `you@example.com` (валидатор **отклоняет** резервированные
   домены вроде `test.local`), пароль от 8 символов.
   - Успех = сразу открывается основной экран, в ответе приходят `access_token` и `refresh_token`.
5. **Карта обучения:** должна быть непустой (5 юнитов / 6 уроков).
   - Пусто → контент не засижен, см. раздел 6.
6. **Урок и ответ на вопрос:** ответ сохраняется, растёт прогресс.
7. **Кейс:** откройте кейс, отправьте решение.
8. **Профиль/XP:** XP и достижения обновляются.

Те же проверки из консоли, если лень тыкать телефон:

```powershell
# регистрация
$r = Invoke-RestMethod -Method Post -Uri http://localhost:8000/auth/register `
  -ContentType 'application/json' `
  -Body (@{ email='you@example.com'; password='Passw0rd!123'; username='you' } | ConvertTo-Json)

# чтение с токеном
$h = @{ Authorization = "Bearer $($r.access_token)" }
Invoke-RestMethod -Uri http://localhost:8000/mascot/phrases -Headers $h | Measure-Object
Invoke-RestMethod -Uri http://localhost:8000/gamification/me  -Headers $h | ConvertTo-Json
```

---

## 8. Остановка и перезапуск

**API** — найти и убить процесс на 8000:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**БД** — остановить dev-кластер:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D .local\pgdata stop
```

Если PostgreSQL другой версии — возьмите `pg_ctl.exe` из её `bin`
(или используйте `$env:PGBIN`).

Отдельного `dev-stop.ps1` в репозитории нет: API и БД останавливаются командами выше.

Перезапуск API после правок кода: остановите процесс и снова выполните
`scripts\dev-start.ps1` — миграции и сид повторятся идемпотентно (~10–16 с).

---

## 9. Troubleshooting

| Симптом | Причина | Что делать |
|---|---|---|
| `PostgreSQL 16 не найден` | Прежний скрипт искал только 16-ю версию | **Исправлено** — версия определяется автоматически. Если всё же: `$env:PGBIN='C:\Program Files\PostgreSQL\17\bin'` |
| Консоль «висит» после запуска API | Родитель ждал закрытия stdout дочернего процесса | **Исправлено** — API запускается полностью отделённым процессом |
| `Не удалось импортировать uvicorn/app.main` | Нет зависимостей или не тот Python | `cd backend; python -m pip install -r requirements.txt` |
| `/health` → `database: fail` | БД не поднята | Запустите `scripts\dev-db.ps1`, проверьте порт 5433 |
| Регистрация → **500** | Упала миграция/таблица | `dev-start.ps1` теперь падает громко; проверьте `alembic upgrade head` |
| Регистрация → **422** | Невалидный email | Домен не из резервированных: `you@example.com`, не `you@test.local` |
| «Карта обучения» пустая | Контент не засижен | Раздел 6, `POST /lexbear/seed` |
| Телефон не видит API | Не тот IP / firewall | Проверьте `mobile\.env`, раздел 5 |
| `mobile\.env` содержит `172.27.x.x` | Выбран виртуальный адаптер WSL | **Исправлено** — перезапустите `dev-mobile.ps1`, он перепишет `.env` |
| Metro не подключается | Другая сеть / VPN | Телефон в той же Wi-Fi; выключите VPN; можно `--tunnel` |
| «Странная» ошибка парсинга скрипта | Файл сохранён без UTF-8 BOM | Пересохраните с BOM (файлы в репо уже с BOM) |

Смотреть логи API:

```powershell
Get-Content .local\backend.err.log -Tail 40 -Wait
```

---

## 10. Полезные команды

```powershell
# миграции
cd backend; alembic upgrade head; alembic current
cd backend; alembic revision --autogenerate -m "описание"

# тесты бэкенда
cd backend; python -m pytest -q

# линт мобильного
cd mobile; npx eslint .

# веб-сборка мобильного (быстрая проверка бандла)
cd mobile; npx expo export --platform web
```

---

## 11. Что было исправлено в `scripts\`

| Файл | Проблема | Решение |
|---|---|---|
| `dev-api.ps1` | Консоль висла навсегда: дочерний `cmd.exe` наследовал stdout родителя, а uvicorn держит его открытым | Запуск через `cmd /c start "" /b` с редиректом в файл — процесс полностью отделён |
| `dev-api.ps1` | Непонятная причина падения при отсутствии зависимостей | Префлайт-импорт `uvicorn` + `app.main` из `backend\` с явным сообщением |
| `dev-db.ps1` | Жёстко зашит `PostgreSQL\16\bin`; на 14/15/17 — отказ | Автопоиск `pg_ctl` через `PATH` → `PGBIN` → `Program Files\PostgreSQL\*` |
| `dev-mobile.ps1` | В `.env` попадал виртуальный адаптер (WSL/Hyper-V) → телефон не видел API | Приоритет DHCP-LAN-адресов, пропуск виртуальных адаптеров, автоисправление `.env` |
| `dev-start.ps1` | Миграции звали голый `python` (мог быть другой интерпретатор) и ошибки глушились | Используется найденный интерпретатор, падение с понятным сообщением |
| все `*.ps1` | Без UTF-8 BOM PowerShell 5.1 читал кириллицу как ANSI и падал на парсинге | BOM `EF BB BF` во всех скриптах |

