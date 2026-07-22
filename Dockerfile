# WMS v2 — single Next.js 16 app
# Stack: Next.js 16 + React 19 + Prisma 7 + Postgres (via pg)

# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client + build Next.js
RUN npx prisma generate \
 && NODE_OPTIONS="--max-old-space-size=4096" npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat tini \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001 -G nodejs

# Copy minimal runtime deps. We keep full node_modules so prisma CLI is
# available for `db push` + seed at container start.
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

# Persistent uploads dir (attachments — UC-INT-02)
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app

USER nextjs

ENV PORT=3000
EXPOSE 3000

# Apply schema (db push for branches without migrations) then start.
# Seed only runs if Admin user not present (idempotent — see prisma/seed.ts).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts; node node_modules/next/dist/bin/next start -p 3000"]
