# ---- deps (install from ROOT lockfile with workspaces)
FROM node:20-alpine AS deps
WORKDIR /repo

# 1) copy only manifests first for better caching
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/ui/package.json packages/ui/
# (add more package.json files for other internal packages this app uses)
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/

COPY packages/db/package.json packages/db/
COPY packages/tailwind-preset/package.json packages/tailwind-preset/
# 2) install all workspaces
# 2) install all workspaces
RUN npm install --workspaces --include-workspace-root --legacy-peer-deps

# 3) now copy the rest of the source
COPY . .

# 4) build just this app
RUN npm run build -w apps/admin

# ---- runner (Next.js standalone)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# If you're using Next "standalone" output, copy these:
COPY --from=deps /repo/apps/admin/.next/standalone ./
COPY --from=deps /repo/apps/admin/.next/static ./.next/static
COPY --from=deps /repo/apps/admin/public ./public
ENV PORT=3002 HOSTNAME=0.0.0.0
EXPOSE 3002
CMD ["node","server.js"]
