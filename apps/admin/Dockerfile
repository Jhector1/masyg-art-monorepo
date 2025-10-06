# ----------------------------------
# Builder (Next.js + optional Prisma)
# ----------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# 1) Install deps with good caching
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# 2) Copy source
COPY . .

# 3) (Optional) Generate Prisma client before build
#    Comment out if you don't use Prisma
RUN if [ -d "prisma" ]; then npx prisma generate; fi

# 4) Enable standalone in next.config.js:
#    module.exports = { output: 'standalone' }
RUN npm run build

# ----------------------------------
# Runner (tiny, no dev deps)
# ----------------------------------
FROM node:20-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Copy the minimal standalone server bundle + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# (Optional) Prisma engines if present
# If prisma was used, the generated client expects these folders:
# - node_modules/.prisma  (engines)
# - prisma/               (schema for runtime tools/scripts, optional)
# They are already in the standalone bundle when present, but this is safe:
# (Uncomment if you need to guarantee availability)
# COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# COPY --from=builder /app/prisma ./prisma

# Run as non-root
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
USER nextjs

# Configurable port (default 3000)
ENV PORT=3000
EXPOSE 3000

# The standalone bundle contains server.js at the project root
CMD ["node", "server.js"]
