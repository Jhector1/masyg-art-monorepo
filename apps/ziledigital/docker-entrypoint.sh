#!/bin/sh
set -euo pipefail

echo "Waiting for database…"
# Extract host/port from DATABASE_URL via Node (robust vs. sed/awk)
DB_HOST="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.hostname)')"
DB_PORT="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.port || 5432)')"

# Busybox nc is present on Alpine; if not, we install it in the Dockerfile below.
i=0
until nc -z "$DB_HOST" "$DB_PORT"; do
  i=$((i+1))
  if [ "$i" -gt 120 ]; then
    echo "Database never became ready."
    exit 1
  fi
  sleep 1
done
echo "DB is up at $DB_HOST:$DB_PORT"

# Run migrations (no prompts; safe in container boot)
echo "Running prisma migrate deploy…"
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma

# Start Next.js server
exec node apps/ziledigital/server.js
