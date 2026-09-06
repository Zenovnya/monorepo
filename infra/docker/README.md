# Деплой backend LexBear на своём сервере (Docker)

Самодостаточный вариант: PostgreSQL + FastAPI-бэкенд в контейнерах на вашем
сервере. Бесплатно (используется уже имеющийся сервер), без внешних аккаунтов,
без санкционных ограничений. Redis не требуется.

## Что нужно на сервере
- Linux-сервер с публичным IP.
- Установленный Docker и Docker Compose (`docker --version`, `docker compose version`).
  Если нет: https://docs.docker.com/engine/install/

## Шаги

```bash
# 1. Забрать код на сервер
git clone https://github.com/KalyvanPriime/monorepo.git
cd monorepo/infra/docker

# 2. Настроить переменные
cp .env.example .env
nano .env        # впишите POSTGRES_PASSWORD, JWT_SECRET_KEY (>=32 симв.), ADMIN_TOKEN
# Сгенерировать секрет: openssl rand -hex 32

# 3. Поднять контейнеры (миграции применятся автоматически)
docker compose up -d --build

# 4. Проверить, что живо
curl http://localhost:8000/health        # {"status":"ok", ...}

# 5. Разово залить контент (уроки/кейсы/статьи)
curl -X POST http://localhost:8000/lexbear/seed -H "X-Admin-Token: <ADMIN_TOKEN>"
```

## Сделать сервер доступным для приложения
- Откройте порт **8000** в файрволе/облачной панели (или проксируйте через nginx на 80/443).
- Проверьте снаружи: `http://<IP-сервера>:8000/health` должен отвечать.
- Для продакшена настройте домен + HTTPS (nginx + certbot) и включите
  `TRUST_PROXY_HEADERS=true` в `.env`.

## Подключить приложение к серверу
В `mobile/eas.json` для нужного профиля задайте адрес API, затем пересоберите APK:

```json
"preview": {
  "distribution": "internal",
  "env": { "EXPO_PUBLIC_API_URL": "http://<IP-сервера>:8000" }
}
```

## Обновление
```bash
cd monorepo && git pull
cd infra/docker && docker compose up -d --build
```

## Полезное
- Логи: `docker compose logs -f backend`
- Остановить: `docker compose down` (данные БД сохранятся в volume `pgdata`)
- Полный сброс БД: `docker compose down -v` (⚠️ удалит данные)
