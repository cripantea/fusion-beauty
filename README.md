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
- **Pagamenti**: incasso in un tap (Carta/POS o Contanti) da dashboard, agenda o
  pagina Pagamenti; l'importo parte dal prezzo del trattamento e il trattamento
  risulta completato. Totale speso e segmento "Cliente fedele" (5+ trattamenti)
  nella scheda cliente.
- **Form per i siti**: costruttore di moduli (`/dashboard/forms`) con script da
  incollare in qualsiasi sito (`/api/embed/form/<id>`, in linea o bolla popup,
  dentro uno shadow DOM) e link diretto `/f/<id>`. Ogni invio (`/api/forms/submit`,
  CORS aperto, honeypot, tempo minimo e limite per IP su Redis) crea o aggiorna la
  scheda cliente confrontando le sole cifre del telefono.
- **Agenda incorporabile**: `/api/embed/booking/<slug>?mode=inline|button|popup|link`
  mette il widget in un iframe che si adatta all'altezza (postMessage). Agende
  personalizzate con `servizi=<id>,…`, `tinta=1`, `intestazione=0`; con `mode=link`
  la aprono i pulsanti del sito con `data-fusion-beauty-booking`.
- **WhatsApp con Fusion WA** (come nel CRM): Fusion Beauty è un'"App" di Fusion WA
  (`FUSION_WA_API_KEY`/`SECRET`, externalCustomerId = tenant.id; si inseriscono nel
  `.env` con `bash scripts/fusion-wa-env.sh [percorso/.env]`, che genera anche il token
  del webhook). `/dashboard/whatsapp` ha le schede Numero (collegamento Embedded
  Signup/Coexistence e stato su Meta), Template e Rubrica (contatti dell'app
  WhatsApp Business → clienti). Chat in `/dashboard/messages`, webhook
  `/api/webhooks/whatsapp?token=…`.
- **Automazioni** (`/dashboard/automations`, come i workflow del CRM): trigger da
  centro estetico (richiesta online, conferma, N ore prima/dopo un appuntamento,
  nuova cliente, form, compleanno, cliente che non torna, questionario, messaggio
  ricevuto) e passi in JSON (template, testo, attesa, se/allora, nota, interesse),
  con modelli pronti. Motore in `src/lib/automation-engine.ts`: il worker riprende
  le attese ogni minuto e cerca i trigger a tempo ogni 15 minuti; invii solo
  9–20 se richiesto.
- **Incassi in cassa spenti di default** (`Tenant.paymentsEnabled`, interruttore "Cassa"
  in `/admin/tenants`): senza, niente Pagamenti/Incassa/POS; incasso **stimato** dai
  prezzi di listino dei trattamenti svolti (non verificato: niente sconti, assenti e
  annullati esclusi) e appuntamenti passati completati dal worker.
- **Link di pagamento con Stripe** (`/dashboard/integrations/stripe`): ogni centro
  collega il proprio Stripe con una chiave ristretta (Checkout Sessions e Webhook
  Endpoints in scrittura; salvata cifrata con AUTH_SECRET); il webhook
  `/api/webhooks/stripe/<tenantId>` lo crea Beauty via API. Dall'appuntamento
  "Link di pagamento" → `/paga/<token>` (carta, Apple/Google Pay, Klarna in 3 rate),
  segnato pagato dal webhook; elenco in `/dashboard/payment-links`.
- **Campagne WhatsApp** (`/dashboard/campaigns`): template a un segmento di
  clienti (tutte, inattive, nuove, compleanno nel mese, trattamento fatto,
  interesse; di default solo con consenso marketing), a scaglioni, con consegnati,
  letti e risposte.
- **Nuova cliente in 10 secondi**: bastano nome, cognome e telefono; poi un link
  WhatsApp (`wa.me`, precompilato) invia il questionario pubblico `/q/[token]` le
  cui risposte (data di nascita, città, allergie, pelle/salute, interessi,
  provenienza) popolano la scheda. Con WhatsApp collegato il questionario parte in
  automatico; altrimenti dall'app WhatsApp dell'operatrice.
- **Agenda per operatrice**, **Richieste online** (prenotazioni dal widget da
  confermare/rifiutare), **Da ricontattare** (clienti inattive da 6+ mesi,
  compleanni, promemoria di domani con messaggio WhatsApp pronto),
  **Statistiche** (giorno/settimana/mese/anno) e **Report mensile** (CSV e
  stampa/PDF).
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
pnpm db:seed          # utenti e catalogo di base
pnpm db:seed:demo     # facoltativo: agenda, incassi e clienti dimostrativi
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
