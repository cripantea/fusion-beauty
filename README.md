# fusion-beauty

Gestionale estetico SaaS multi-tenant: ogni centro estetico (tenant) gestisce
in isolamento anagrafica clienti, catalogo trattamenti, agenda appuntamenti,
un widget di prenotazione pubblico embeddabile e la sincronizzazione con
calendari esterni. Un livello super-admin gestisce l'onboarding e lo stato
dei tenant.

## Soluzione tecnica

**Multi-tenancy.** Un singolo database PostgreSQL ospita tutti i tenant.
L'isolamento non è a livello di schema/database ma applicativo: ogni modello
operativo (`Client`, `Service`, `Appointment`, `TenantIntegration`,
`ExternalCalendarEvent`) porta una colonna `tenantId` e ogni query passa
sempre da un helper di contesto tenant (`getTenantContext`) che deriva il
`tenantId` dalla sessione autenticata — non è mai accettato da input utente.
Gli utenti `SUPER_ADMIN` non hanno `tenantId` e operano nell'area `/admin`
con visibilità cross-tenant (gestione anagrafica centri, sospensione
account).

**Autenticazione.** Sessioni JWT firmate (libreria `jose`), password con
hashing `bcryptjs`, cookie httpOnly. Non viene usato NextAuth/Auth.js: la
logica di login/sessione è custom in `src/lib/auth/`. Il `proxy.ts` (il
middleware di Next.js 16) protegge `/dashboard/:path*` e `/admin/:path*`
con una allow-list: qualunque altra rotta (incluse `/embed/*` e `/api/*`,
necessarie al widget pubblico) è pubblica di default. Un tenant sospeso
(`isActive: false`) blocca sia il login sia le sessioni già attive.

**Dati e persistenza.** Prisma 7 con driver adapter obbligatorio
(`@prisma/adapter-pg` su `pg`), PostgreSQL 16. Modelli principali: `Tenant`,
`User` (ruoli `SUPER_ADMIN` / `ADMIN` / `OPERATOR`), `Client`, `Service`,
`Appointment`, più `TenantIntegration` ed `ExternalCalendarEvent` per la
sincronizzazione calendari.

**Moduli applicativi (dashboard):**
- **Anagrafica clienti** e **catalogo trattamenti**, scoping multi-tenant.
- **Calendario interno**: agenda giorno/settimana con creazione/modifica
  appuntamenti, basata su `react-day-picker` + `date-fns`.
- **Dashboard con metriche**: appuntamenti del giorno e KPI aggregati.
- **Widget di prenotazione pubblico** (`/embed/[slug]`): pagina pubblica,
  senza autenticazione, per la prenotazione online da parte dei clienti
  finali; calcola gli slot liberi incrociando appuntamenti interni ed eventi
  importati da calendari esterni, con transazione a isolamento
  `Serializable` per evitare doppie prenotazioni sullo stesso slot.
- **Sincronizzazione calendari esterni**: esportazione ICS per tenant
  (feed protetto da token, consumabile da Apple/Outlook/Google Calendar),
  importazione di un calendario iCal esterno via URL (blocca gli slot
  corrispondenti nell'agenda e nel widget), e una connessione Google
  Calendar dimostrativa (stub, senza OAuth reale).
- **Gestione tenant (super-admin)**: creazione, modifica e sospensione dei
  centri estetici.

**Background jobs.** Redis 7 + BullMQ, worker separato (`pnpm worker` /
target Docker `worker`) per elaborazioni asincrone.

**UI.** Tailwind CSS v4 + Shadcn/ui (su base-ui) + Lucide Icons, componenti
condivisi in `src/components/ui/`.

## Stack

- Next.js 16 (App Router) + TypeScript (strict)
- Prisma 7 + PostgreSQL 16 (driver adapter `@prisma/adapter-pg`)
- Redis 7 + BullMQ (background jobs)
- Tailwind CSS v4 + Shadcn/ui + Lucide Icons
- Autenticazione custom via JWT (`jose`) + `bcryptjs`

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

`app` è esposto solo su `127.0.0.1:${APP_PORT:-3013}` (da mettere dietro un
reverse proxy). Redis richiede autenticazione (`REDIS_PASSWORD`). Il seed di
produzione (`pnpm db:seed:prod`) crea solo l'account `SUPER_ADMIN` — nessun
dato demo — a partire da `SEED_SUPER_ADMIN_EMAIL` /
`SEED_SUPER_ADMIN_PASSWORD` in `.env`.

Deploy live: **https://beauty.fusionsoft.it**.
