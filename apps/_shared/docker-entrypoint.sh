#!/bin/sh
set -euo pipefail

echo "Waiting for database…"
DB_HOST="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.hostname)')"
DB_PORT="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.port || 5432)')"

i=0
until nc -z "$DB_HOST" "$DB_PORT"; do
  i=$((i+1))
  [ "$i" -gt 120 ] && { echo "Database never became ready."; exit 1; }
  sleep 1
done
echo "DB is up at $DB_HOST:$DB_PORT"

SCHEMA_PATH="/app/packages/db/prisma/schema.prisma"

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "Running prisma migrate deploy with --schema=$SCHEMA_PATH"
  if [ ! -f "$SCHEMA_PATH" ]; then
    echo "FATAL: Prisma schema not found at $SCHEMA_PATH"
    ls -la /app/packages/db || true
    ls -la /app/packages/db/prisma || true
    exit 1
  fi
  npx prisma@6.17.0 migrate deploy --schema "$SCHEMA_PATH"
else
  echo "RUN_MIGRATIONS!=1 — skipping migrations"
fi

exec node "apps/${APP_NAME}/server.js"
