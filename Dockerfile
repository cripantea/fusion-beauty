# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps ---------------------------------------------------------------
# prisma/ + config are copied here too because the "postinstall" script
# (`prisma generate`) needs the schema to be present at install time.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY prisma7.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ---- builder --------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- runner (Next.js standalone server) -----------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]

# ---- worker (BullMQ background jobs) ---------------------------------------
FROM base AS worker
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .
RUN pnpm prisma generate

USER nextjs
CMD ["pnpm", "worker"]
