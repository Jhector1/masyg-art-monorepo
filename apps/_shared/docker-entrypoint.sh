#!/bin/sh
set -euo pipefail

APP_NAME="${APP_NAME:-ziledigital}"   # default if not provided
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}" # 1 = run, 0 = skip

need_db() {
  [ "${RUN_MIGRATIONS}" = "1" ]
}

if need_db; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is not set but RUN_MIGRATIONS=1"; exit 1
  fi

  echo "Waiting for database…"
  # pull host/port from DATABASE_URL with Node (robust)
  DB_HOST="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.hostname)')"
  DB_PORT="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.port||5432)')"

  # Alpine has busybox nc; if not, install netcat-openbsd in Dockerfile
  i=0
  until nc -z "${DB_HOST}" "${DB_PORT}"; do
    i=$((i+1))
    if [ "${i}" -gt 120 ]; then
      echo "Database never became ready."; exit 1
    fi
    sleep 1
  done
  echo "DB is up at ${DB_HOST}:${DB_PORT}"

  echo "Running prisma migrate deploy…"
  # use npm exec so it uses the workspace-installed prisma
  npm exec prisma migrate deploy --schema packages/db/prisma/schema.prisma
else
  echo "RUN_MIGRATIONS=0 — skipping migrations."
fi

echo "Starting Next.js app: ${APP_NAME}"
exec node "apps/${APP_NAME}/server.js"
