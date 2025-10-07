# ---- deps
FROM node:20-alpine AS deps
WORKDIR /repo

ARG APP_NAME
ARG APP_PORT
ENV APP_NAME=${APP_NAME}
ENV APP_PORT=${APP_PORT}

# 1) copy root manifests EXPLICITLY (no wildcard)
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

# (optional but helpful) prove they are here
RUN node -v && npm -v && ls -l package.json package-lock.json && \
    head -n 5 package-lock.json || true


COPY apps/${APP_NAME}/package.json apps/${APP_NAME}/
COPY packages/ui/package.json packages/ui/
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/db/package.json packages/db/
COPY packages/tailwind-preset/package.json packages/tailwind-preset/

# 2) force npm to use the lockfile, then install
RUN npm config set package-lock true && \
    npm config set fund false && \
    npm config set audit false && \
    npm ci --legacy-peer-deps --ignore-scripts


# 3) copy the source
COPY . .

# 4) build the TS tailwind preset (so Next can resolve it)
RUN npm run -w packages/tailwind-preset build

# 5) prisma client + app build
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN NEXT_DISABLE_ESLINT=1 NEXT_TELEMETRY_DISABLED=1 npm run build -w apps/${APP_NAME}

# ---- runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG APP_NAME
ARG APP_PORT
ENV APP_NAME=${APP_NAME}
ENV PORT=${APP_PORT}
ENV HOSTNAME=0.0.0.0

# Next standalone
COPY --from=deps /repo/apps/${APP_NAME}/.next/standalone ./
COPY --from=deps /repo/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=deps /repo/apps/${APP_NAME}/public ./public

# schema needed for migrate at runtime (if enabled)
COPY --from=deps /repo/packages/db/prisma ./packages/db/prisma

# tiny entrypoint: only ziledigital will run migrations

COPY apps/_shared/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE ${APP_PORT}
CMD ["sh","-lc","./docker-entrypoint.sh"]
