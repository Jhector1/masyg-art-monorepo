# ─────────────────────────────────────────────────────────────────────────────
# apps/_shared/Dockerfile.app
# Build one of your apps (ARG APP_NAME) using the shared monorepo
# ─────────────────────────────────────────────────────────────────────────────

# ===== deps (build) stage ====================================================
FROM node:20-alpine AS deps
WORKDIR /repo

# tools available during build (and mirrored in runner)
RUN apk add --no-cache wget netcat-openbsd

# Which app are we building? (passed from docker-compose args)
ARG APP_NAME
ARG APP_PORT
ENV APP_NAME=${APP_NAME}
ENV APP_PORT=${APP_PORT}

# 1) copy root manifests first (strict, no globs so they definitely exist)
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

# sanity checks (node/npm versions and lockfile presence)
RUN node -e "console.log('node',process.version)" \
 && npm -v \
 && ls -l package.json package-lock.json \
 && node -e "console.log('lockfileVersion:', require('./package-lock.json').lockfileVersion)"

# 2) copy workspace manifests so npm can resolve without copying full repo yet
COPY apps/${APP_NAME}/package.json apps/${APP_NAME}/
COPY packages/ui/package.json            packages/ui/
COPY packages/core/package.json          packages/core/
COPY packages/server/package.json        packages/server/
COPY packages/db/package.json            packages/db/
COPY packages/tailwind-preset/package.json packages/tailwind-preset/

# 3) if a .npmrc tries to disable lockfiles, force-enable them (prevents EUSAGE)
#    (only changes inside the image build; your repo files remain untouched)
RUN if [ -f .npmrc ]; then \
      sed -i 's/^package-lock=.*$/package-lock=true/' .npmrc || true; \
      grep -q '^package-lock=' .npmrc || echo 'package-lock=true' >> .npmrc; \
      echo '---- .npmrc after patch ----'; cat .npmrc || true; \
    fi

# 4) install deps from the root using the lockfile
#    - try `npm ci` first
#    - if it fails (EUSAGE or similar), fallback once to `npm install`
RUN --mount=type=cache,target=/root/.npm \
  (npm ci --ignore-scripts \
   || (echo 'npm ci failed — falling back to npm install' \
       && npm install --ignore-scripts --legacy-peer-deps))

# 5) now copy the full source
COPY . .

# 6) build the TS Tailwind preset (needed so Next can resolve it)
RUN npm run -w packages/tailwind-preset build

# 7) generate Prisma client and build the app
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN NEXT_DISABLE_ESLINT=1 NEXT_TELEMETRY_DISABLED=1 npm run build -w apps/${APP_NAME}

# ===== runner (runtime) stage ===============================================
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# tools for healthcheck + entrypoint (wget + nc)
RUN apk add --no-cache wget netcat-openbsd

ARG APP_NAME
ARG APP_PORT
ENV APP_NAME=${APP_NAME}
ENV PORT=${APP_PORT}
ENV HOSTNAME=0.0.0.0

# Next standalone output
COPY --from=deps /repo/apps/${APP_NAME}/.next/standalone ./
COPY --from=deps /repo/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=deps /repo/apps/${APP_NAME}/public ./public

# Prisma schema for runtime migrations (entrypoint controls whether it runs)
COPY --from=deps /repo/packages/db/prisma ./packages/db/prisma

# tiny entrypoint shared by all apps (controls migrate or just start)
COPY apps/_shared/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE ${APP_PORT}
CMD ["sh","-lc","./docker-entrypoint.sh"]
