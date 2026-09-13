# fusion-beauty

Gestionale estetico SaaS Multi-Tenant.

## Stack

- Next.js 16 (App Router) + TypeScript (strict)
- Prisma 7 + PostgreSQL 16
- Redis 7 + BullMQ (background jobs)
- Tailwind CSS v4 + Shadcn/ui + Lucide Icons

## Sviluppo locale

```bash
cp .env.example .env
pnpm install
docker compose up -d db redis
pnpm prisma migrate dev
pnpm dev
```

Il worker BullMQ si avvia con:

```bash
pnpm worker
```

Oppure avvia l'intero stack (app + worker + db + redis) con Docker:

```bash
docker compose up --build
```

## Produzione

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

`app` è esposto solo su `127.0.0.1:3000` (da mettere dietro un reverse proxy).
