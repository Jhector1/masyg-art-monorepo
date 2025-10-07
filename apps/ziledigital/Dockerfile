# ---- deps
FROM node:20-alpine AS deps
WORKDIR /repo

# 1) manifests only for caching
COPY package.json package-lock.json ./
COPY apps/ziledigital/package.json apps/ziledigital/
COPY packages/ui/package.json packages/ui/
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/db/package.json packages/db/
COPY packages/tailwind-preset/package.json packages/tailwind-preset/

# 2) install, but skip scripts (so postinstall doesn’t run yet)
RUN npm ci --workspaces --include-workspace-root --legacy-peer-deps --ignore-scripts

# 3) now copy the rest of the source
COPY . .

# 4) build the TS preset now that its files are here
RUN npm run -w packages/tailwind-preset build

# 5) prisma + app build
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN NEXT_DISABLE_ESLINT=1 NEXT_TELEMETRY_DISABLED=1 npm run build -w apps/ziledigital

# ---- runner (unchanged)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /repo/apps/ziledigital/.next/standalone ./
COPY --from=deps /repo/apps/ziledigital/.next/static ./apps/ziledigital/.next/static
COPY --from=deps /repo/apps/ziledigital/public ./public
ENV PORT=3003 HOSTNAME=0.0.0.0
EXPOSE 3003
CMD ["node","apps/ziledigital/server.js"]
