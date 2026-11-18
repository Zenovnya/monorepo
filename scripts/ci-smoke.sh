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

echo "=== 1. Пакет контента ==="
# Сида в БД больше нет: контент — файл (app/content_packs/themes.json), его
# единственная копия, и она проверяется теми же правилами, что и импорт.
# Битый пак должен ломать деплой, а не экран пользователя.
if ! python -m app.modules.adaptive.seed > pack.log 2>&1; then
  dump pack.log
  fail "пакет тем не прошёл проверку: $(tail -c 700 pack.log | tr '\n' ' ')"
  exit 1
fi
tail -c 600 pack.log

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
# Ручки закрыты токеном: 401 подтверждает, что роутер собран, а не потерян
# при импорте (именно так ломается регистрация роутеров).
for path in /adaptive /adaptive/next; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8000$path")
  echo "GET $path -> $code"
  if [ "$code" != "401" ] && [ "$code" != "403" ]; then
    dump uvicorn.log
    fail "GET $path вернул $code вместо 401"
    exit 1
  fi
done

# Проверка наполнения, а не только роутеров. Дефект, который это ловит:
# урок объявлен, но проверочной карточки в нём нет — пользователь открывает
# урок и не может пройти проверку. Такой контент проходит схемы и стартует
# без ошибок, поэтому считать надо по самому паку.
python - <<'PY' || { fail "пакет тем пуст или неполон"; exit 1; }
import sys

sys.path.insert(0, ".")

from app.modules.adaptive.engine import choose, State
from app.modules.adaptive.pack import load_pack, validate


def main() -> int:
    pack = load_pack()
    validate(pack)
    print(
        f"тем: {len(pack.topics)}, уроков: {len(pack.lessons)}, "
        f"карточек: {len(pack.items)}, норм: {len(pack.authorities)}"
    )
    if len(pack.topics) < 6:
        print("тем меньше шести")
        return 1
    empty = [t for t in pack.topics if not [
        lesson for lesson in pack.lessons.values() if lesson["primary_topic_id"] == t
    ]]
    if empty:
        print("темы без уроков: " + ", ".join(empty))
        return 1
    # Каждый урок обязан иметь проверку и резервный кейс: без них урок
    # открывается, но пройти его нельзя.
    for lesson in pack.lessons.values():
        control = pack.items.get(lesson["control_id"])
        if control is None or control["kind"] != "lesson_check":
            print(f"у урока {lesson['id']} нет проверочной карточки")
            return 1
        if not any(
            item["kind"] == "recommend_case" and item["lesson_id"] == lesson["id"]
            for item in pack.items.values()
        ):
            print(f"у урока {lesson['id']} нет резервного кейса")
            return 1
    # Движок обязан выдать кейс пустому пользователю: иначе контент есть, а
    # практика «не рекомендует» ничего.
    choice = choose(pack, State())
    print("первый рекомендованный кейс:", choice.item_id, choice.topic_id)
    if not choice.item_id:
        print("движок не выбрал ни одного кейса")
        return 1
    return 0


raise SystemExit(main())
PY

echo "SMOKE OK"
