# ---- deps (install from ROOT lockfile with workspaces)
FROM node:20-alpine AS deps
WORKDIR /repo

# 1) copy only manifests first for better caching
COPY package.json package-lock.json ./
COPY apps/ziledigital/package.json apps/ziledigital/
# If you know exactly which internal packages are used, list them:
COPY packages/ui/package.json packages/ui/
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/db/package.json packages/db/
# If you have this package; otherwise comment it out:
COPY packages/tailwind-preset/package.json packages/tailwind-preset/

# 2) install all workspaces using the root lockfile
RUN npm ci --workspaces --include-workspace-root --legacy-peer-deps

# 3) now copy the rest of the source
COPY . .

# 4) generate Prisma client from the SHARED schema
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

# 5) build just this app (skip lint in container to avoid CI coupling)
RUN NEXT_DISABLE_ESLINT=1 NEXT_TELEMETRY_DISABLED=1 npm run build -w apps/ziledigital

# ---- runner (Next.js standalone)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# If you're using Next "standalone" output, copy these:
COPY --from=deps /repo/apps/ziledigital/.next/standalone ./
COPY --from=deps /repo/apps/ziledigital/.next/static ./.next/static
COPY --from=deps /repo/apps/ziledigital/public ./public
ENV PORT=3003 HOSTNAME=0.0.0.0
EXPOSE 3003
CMD ["node","apps/ziledigital/server.js"]
