# ---------- deps (build) ----------
FROM node:20-alpine AS deps
WORKDIR /repo

# put these lines right after WORKDIR /repo
ENV NPM_CONFIG_PACKAGE_LOCK=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# copy package.json + package-lock.json etc. (unchanged)

# (optional) fix project .npmrc if present
RUN if [ -f .npmrc ]; then \
      sed -i 's/^package-lock=.*$/package-lock=true/' .npmrc || true; \
      grep -n '^package-lock' .npmrc || echo 'package-lock=true' >> .npmrc; \
    fi



ARG APP_NAME
ARG APP_PORT
ENV APP_NAME=${APP_NAME}
ENV APP_PORT=${APP_PORT}

# Tools used at runtime in the runner too; install now for cache/share
RUN apk add --no-cache wget netcat-openbsd

# 1) Copy ONLY the root manifests first (keeps cache stable)
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

# Quick visibility that npm sees what we expect
RUN node -e "console.log('node',process.version)" \
 && npm -v \
 && ls -l package.json package-lock.json \
 && node -e "console.log('lockfileVersion:', require('./package-lock.json').lockfileVersion)" \
 || true

# 2) Copy workspace manifests needed for dependency graph
COPY apps/${APP_NAME}/package.json apps/${APP_NAME}/
COPY packages/ui/package.json            packages/ui/
COPY packages/core/package.json          packages/core/
COPY packages/server/package.json        packages/server/
COPY packages/db/package.json            packages/db/
COPY packages/tailwind-preset/package.json packages/tailwind-preset/

# 3) Install from the root, for ALL workspaces, using the lockfile
#    Use BuildKit cache to speed this up on rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspaces --include-workspace-root --legacy-peer-deps --ignore-scripts
# If npm is finicky on this host, use this fallback ONCE:
# RUN --mount=type=cache,target=/root/.npm \
#     npm install --workspaces --include-workspace-root --legacy-peer-deps --ignore-scripts

# 4) Now bring in the source code
COPY . .

# 5) Build the TS Tailwind preset so Next can resolve it during build
RUN npm run -w packages/tailwind-preset build

# 6) Prisma Client + app build
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
ENV NEXT_DISABLE_ESLINT=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/${APP_NAME}

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# small utilities used by the entrypoint (healthcheck + DB wait)
RUN apk add --no-cache wget netcat-openbsd

ARG APP_NAME
ARG APP_PORT
ENV APP_NAME=${APP_NAME}
ENV PORT=${APP_PORT}
ENV HOSTNAME=0.0.0.0

# Next.js standalone output
COPY --from=deps /repo/apps/${APP_NAME}/.next/standalone ./
COPY --from=deps /repo/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=deps /repo/apps/${APP_NAME}/public ./public

# Prisma schema for runtime migrate (only the app with RUN_MIGRATIONS=1 will run it)
COPY --from=deps /repo/packages/db/prisma ./packages/db/prisma

# Tiny shared entrypoint that waits for DB and (optionally) runs prisma migrate deploy
COPY apps/_shared/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE ${APP_PORT}
CMD ["sh","-lc","./docker-entrypoint.sh"]
