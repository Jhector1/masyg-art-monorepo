#!/usr/bin/env bash
# One-off disposable PostgreSQL verification; NEVER touches the repository .env DB.
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo"
command -v docker >/dev/null 2>&1 || { echo 'REFUSED: Docker required for disposable acceptance database' >&2; exit 2; }
docker info >/dev/null 2>&1 || { echo 'REFUSED: Docker daemon is unavailable' >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo 'REFUSED: python3 required' >&2; exit 2; }
read -r ident password <<EOF
$(python3 - <<'PYCODE'
import secrets
print(secrets.token_hex(6), secrets.token_hex(16))
PYCODE
)
EOF
container="zd-claim-acceptance-${ident}"
dbname="ziledigital_acceptance_${ident}"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT
# -p 127.0.0.1::5432 asks Docker to allocate a local ephemeral port.
docker run --detach --rm --name "$container" \
  -p 127.0.0.1::5432 \
  -e POSTGRES_DB="$dbname" \
  -e POSTGRES_USER=zd_claim_acceptance \
  -e POSTGRES_PASSWORD="$password" \
  postgres:16-alpine >/dev/null
ready=0
for n in $(seq 1 60); do
  if docker exec "$container" pg_isready -U zd_claim_acceptance -d "$dbname" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" -eq 1 ]] || { echo 'Acceptance PostgreSQL did not start' >&2; exit 3; }
port="$(docker port "$container" 5432/tcp | sed -n 's/^127\.0\.0\.1://p' | head -n 1)"
[[ "$port" =~ ^[0-9]+$ ]] || { echo 'Could not discover local acceptance port' >&2; exit 4; }
acceptance_url="postgresql://zd_claim_acceptance:${password}@127.0.0.1:${port}/${dbname}?schema=public"
# No migrate reset and no contact with the application's existing DATABASE_URL.
DATABASE_URL="$acceptance_url" npm exec --workspace=@acme/db -- prisma validate
DATABASE_URL="$acceptance_url" npm run generate --workspace=@acme/db
DATABASE_URL="$acceptance_url" npm exec --workspace=@acme/db -- prisma db push --skip-generate
ZILEDIGITAL_ACCEPTANCE_RUN=YES DATABASE_URL="$acceptance_url" \
  npm run test --workspace=@acme/core -- --runTestsByPath \
  src/lib/guest-purchase-claim.postgres.test.ts
printf '\nZILEDIGITAL_GUEST_POSTGRES_V19_ACCEPTANCE_PASS\n'
