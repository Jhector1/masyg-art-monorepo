#!/bin/sh
set -e

echo "Waiting for database…"
tries=0
until npm dlx prisma@latest db execute --schema packages/db/prisma/schema.prisma --stdin  <<'SQL'
SELECT 1;
SQL
do
  tries=$((tries+1))
  if [ $tries -ge 30 ]; then
    echo "Database never became ready."
    exit 1
  fi
  sleep 2
done

echo "Running migrations…"
npm dlx prisma@latest migrate deploy --schema packages/db/prisma/schema.prisma

echo "Starting app…"
exec node apps/ziledigital/server.js
