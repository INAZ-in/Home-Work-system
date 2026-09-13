#!/usr/bin/env bash
# One-shot local bootstrap: builds+starts the stack, runs migrations, and
# seeds the schedule from the static JSON fallback (see backend/src/db/seed).
#
# IMPORTANT: --start below MUST be the actual Monday your semester's week 1
# starts on — everything else (числитель/знаменатель resolution) is computed
# from it. Edit it before running, or pass your own via SEMESTER_START.
set -euo pipefail
cd "$(dirname "$0")/.."

SEMESTER_NAME="${SEMESTER_NAME:-Текущий семестр}"
# 2026-08-31 is the Monday of the week containing Sept 1, 2026 — seed.ts
# rejects any --start that isn't a Monday, so this must stay a real Monday.
SEMESTER_START="${SEMESTER_START:-2026-08-31}"

if [ ! -f .env ]; then
  echo "No .env found — copying .env.example. Edit POSTGRES_PASSWORD before deploying anywhere but your own machine."
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    generated_secret="$(openssl rand -hex 32)"
    sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=${generated_secret}/" .env && rm -f .env.bak
    echo "Generated a random JWT_SECRET in .env."
  else
    echo "WARNING: openssl not found — JWT_SECRET is still the placeholder from .env.example. Set a real random value in .env before deploying anywhere but your own machine."
  fi
fi

echo "==> Building and starting containers..."
docker compose up -d --build

echo "==> Waiting for postgres to be healthy..."
until [ "$(docker compose ps -q postgres | xargs docker inspect -f '{{.State.Health.Status}}')" = "healthy" ]; do
  sleep 2
done

echo "==> Running migrations..."
docker compose run --rm backend npm run migrate

echo "==> Seeding schedule (semester: \"$SEMESTER_NAME\", start: $SEMESTER_START)..."
docker compose run --rm backend npm run seed -- --semester="$SEMESTER_NAME" --start="$SEMESTER_START"

cat <<EOF

Done.
  Frontend (dev):        http://localhost:5173
  Backend health check:  http://localhost:4000/api/health

Next: open the frontend and log in with the default admin account —
name "admin", password "admin123" — then change that password right away
(Админ → Пользователи → Сменить пароль), it's a well-known default. Create
or register an account for each group-mate, go to "Админ" and search your
group in the LKS lookup to set bmstu_group_uuid — that's what the nightly
sync (and the "Синхронизировать сейчас" button) uses to keep the schedule
live instead of relying only on the seeded JSON.
EOF
