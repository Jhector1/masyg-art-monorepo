# ---- deps (install from ROOT lockfile with workspaces)
FROM node:20-alpine AS deps
WORKDIR /repo

# 1) copy only manifests first for better caching
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/ui/package.json packages/ui/
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/db/package.json packages/db/
# If this package exists; otherwise comment the next line
# COPY packages/tailwind-preset/package.json packages/tailwind-preset/

# 2) install all workspaces using the root lockfile
RUN npm ci --workspaces --include-workspace-root --legacy-peer-deps

# 3) now copy the rest of the source
COPY . .

# 4) generate Prisma client from the SHARED schema
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

# 5) build just this app (skip lint in container)
RUN NEXT_DISABLE_ESLINT=1 NEXT_TELEMETRY_DISABLED=1 npm run build -w apps/admin

# ---- runner (Next.js standalone)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /repo/apps/admin/.next/standalone ./
COPY --from=deps /repo/apps/admin/.next/static ./.next/static
COPY --from=deps /repo/apps/admin/public ./public
ENV PORT=3002 HOSTNAME=0.0.0.0
EXPOSE 3002
CMD ["node","server.js"]
