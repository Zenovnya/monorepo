#!/usr/bin/env bash
# Проверка «как в проде»: миграции + сид контента + живой сервер + запросы.
#
# Зачем отдельный скрипт: шаг CI, который падает по неясной причине, бесполезен.
# Здесь всё, что может сломаться, печатается по ходу, а итоговая ошибка уходит
# в аннотацию GitHub (`::error::`) — её видно в checks API, то есть и без
# скачивания логов, которые из скриптов недоступны.
#
# Запуск: bash scripts/ci-smoke.sh   (из каталога backend)
set -uo pipefail

FAILED=""
fail() {
  FAILED="$1"
  echo "::error title=smoke::$(echo "$1" | tr '\n' ' ' | cut -c1-900)"
}

dump() {
  echo "===== $1 ====="
  tail -c 3000 "$1" 2>/dev/null || echo "(файла нет)"
}

echo "=== 1. Сид контента ==="
if ! python -m app.seed > seed.log 2>&1; then
  dump seed.log
  fail "python -m app.seed упал: $(tail -c 700 seed.log | tr '\n' ' ')"
  exit 1
fi
tail -c 600 seed.log

echo "=== 2. Сервер ==="
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > uvicorn.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

ready=""
for _ in $(seq 1 40); do
  sleep 1
  if curl -fsS http://127.0.0.1:8000/health -o health.json 2>/dev/null; then ready=1; break; fi
done

if [ -z "$ready" ]; then
  dump uvicorn.log
  fail "API не ответил на /health за 40 с: $(tail -c 700 uvicorn.log | tr '\n' ' ')"
  exit 1
fi

echo "--- health ---"
cat health.json
echo

python - <<'PY' || { fail "health вернул database != ok"; exit 1; }
import json
data = json.load(open("health.json"))
assert data["database"] == "ok", data
print("database ok")
PY

echo "=== 3. Контент доступен и НАПОЛНЕН ==="
# Контентные роуты закрыты токеном: 401 подтверждает, что роутер собран,
# а не потерян при импорте (именно так ломается регистрация роутеров).
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/lexbear/cases)
echo "GET /lexbear/cases -> $code"
if [ "$code" != "401" ]; then
  dump uvicorn.log
  fail "GET /lexbear/cases вернул $code вместо 401"
  exit 1
fi

# Проверка наполнения, а не только роутеров. Дефект, который это ловит:
# юнит объявлен в curriculum.json, но уроков в нём нет — пользователь видит
# «остров», который нельзя пройти. Такой контент проходит и тесты схемы, и
# сид без ошибок, поэтому проверять надо в БД, после настоящего импорта.
python - <<'PY' || { fail "контент в БД пуст или неполон"; exit 1; }
import asyncio
import sys

sys.path.insert(0, ".")

from sqlalchemy import func, select

from app.database import async_session_factory
from app.modules.content.lexbear_models import LexBearLesson, Question, Unit


async def main() -> int:
    async with async_session_factory() as session:
        units = (await session.execute(
            select(Unit.code, func.count(LexBearLesson.id))
            .outerjoin(LexBearLesson, LexBearLesson.unit_id == Unit.id)
            .where(Unit.is_active.is_(True))
            .group_by(Unit.code)
        )).all()
        lessons = await session.scalar(
            select(func.count(LexBearLesson.id)).where(LexBearLesson.is_active.is_(True))
        )
        questions = await session.scalar(
            select(func.count(Question.id))
            .join(LexBearLesson, Question.lesson_id == LexBearLesson.id)
            .where(LexBearLesson.is_active.is_(True))
        )

    print(f"юнитов: {len(units)}, уроков: {lessons}, вопросов: {questions}")
    empty = [code for code, count in units if count == 0]
    if not units:
        print("нет ни одного активного юнита")
        return 1
    if empty:
        print("активные юниты без уроков: " + ", ".join(empty))
        return 1
    if (lessons or 0) < 25 or (questions or 0) < 125:
        print(f"контента меньше минимума MVP: уроков {lessons}/25, вопросов {questions}/125")
        return 1
    return 0


raise SystemExit(asyncio.run(main()))
PY

echo "SMOKE OK"
