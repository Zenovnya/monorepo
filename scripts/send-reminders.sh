#!/usr/bin/env sh
# Запуск рассылки напоминаний (стрик, цель дня, повторения).
#
# Планировщика в проекте нет, поэтому запуск вынесен наружу:
#   * Railway Scheduled Job / GitHub Actions cron / системный crontab;
#   * вручную для проверки.
#
# Пример crontab (каждый день в 18:00 по UTC):
#   0 18 * * * /app/scripts/send-reminders.sh
#
# Переменные: API_URL (по умолчанию локальный uvicorn), ADMIN_TOKEN.
#   API_URL=https://api.example.com ADMIN_TOKEN=... ./scripts/send-reminders.sh
#
# DRY_RUN=1 — только план, ничего не отправляется.

set -eu

API_URL="${API_URL:-http://localhost:8000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
DRY_RUN="${DRY_RUN:-0}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "ADMIN_TOKEN не задан — рассылка недоступна (эндпоинт за админом)." >&2
  exit 1
fi

QUERY="?dry_run=true"
if [ "$DRY_RUN" = "0" ]; then
  QUERY=""
fi

echo "→ Рассылка напоминаний: ${API_URL}/admin/content/notifications/dispatch${QUERY}"

curl --fail-with-body -sS -X POST \
  "${API_URL}/admin/content/notifications/dispatch${QUERY}" \
  -H "X-Admin-Token: ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json"

echo
