FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic.ini .
COPY migrations ./migrations

EXPOSE 8000

# Число воркеров задаётся переменной WEB_CONCURRENCY (по умолчанию 2).
# ВНИМАНИЕ: суммарное число соединений с БД = DB_POOL_SIZE × WEB_CONCURRENCY
# (+ overflow). Держите его в пределах лимита Postgres/Supabase; при большом
# числе воркеров используйте пул-прокси (Supabase pooler / PgBouncer).
# Rate-limit теперь распределённый (Redis), поэтому несколько воркеров
# считают лимит совместно.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-2}"]