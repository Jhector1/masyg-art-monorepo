# ---- deps / builder ---------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /repo

ARG APP_NAME
ARG APP_PORT
ENV APP_NAME=${APP_NAME}
ENV APP_PORT=${APP_PORT}

# 1) Copy root manifests (explicit) so `npm ci` can run
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

# Sanity: show versions & ensure lockfile exists (ci requires it)
RUN node -v && npm -v && \
    ls -l package.json package-lock.json && \
    head -n 5 package-lock.json && \
    test -s package-lock.json

# 2) Copy workspace manifests to get best cache hit
COPY apps/${APP_NAME}/package.json apps/${APP_NAME}/
COPY packages/ui/package.json packages/ui/
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/db/package.json packages/db/
COPY packages/tailwind-preset/package.json packages/tailwind-preset/

# 3) Install from the repo root for all workspaces
#    Use BuildKit cache if available (speeds up rebuilds)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --ignore-scripts

# 4) Bring in the rest of the source
COPY . .

# 5) Build the TS Tailwind preset so Next can resolve it
RUN npm run -w packages/tailwind-preset build

# 6) Generate Prisma client (shared schema)
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

# 7) Build the app (standalone output used in runner)
ENV NEXT_DISABLE_ESLINT=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/${APP_NAME}

# ---- runner -----------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG APP_NAME
ARG APP_PORT
ENV APP_NAME=${APP_NAME}
ENV PORT=${APP_PORT}
ENV HOSTNAME=0.0.0.0

# Tools for healthcheck/entrypoint
RUN apk add --no-cache wget netcat-openbsd

# Next standalone + static assets + public
COPY --from=deps /repo/apps/${APP_NAME}/.next/standalone ./
COPY --from=deps /repo/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=deps /repo/apps/${APP_NAME}/public ./public

# Prisma schema (so migrations can run at runtime if enabled)
COPY --from=deps /repo/packages/db/prisma ./packages/db/prisma

# Entrypoint shared by all apps (decides whether to run migrations)
# Expect this file at apps/_shared/docker-entrypoint.sh
COPY apps/_shared/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE ${APP_PORT}
CMD ["sh","-lc","./docker-entrypoint.sh"]
