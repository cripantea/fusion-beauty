// Account dimostrativo "Salone Demo" (parrucchiere + estetica) da mostrare ai saloni.
// Crea un centro a parte con staff, trattamenti, ~80 clienti, 4 mesi di storico,
// agenda piena di oggi e delle prossime settimane, incassi, consensi, percorsi,
// automazioni, campagne e conversazioni WhatsApp. Tutti i dati sono inventati.
//
// Rilanciandolo il centro demo viene cancellato e ricreato con le date di oggi.
// Tocca SOLO il centro con slug "salone-demo".
//
//   DEMO_PASSWORD=... pnpm db:seed:demo-salone
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import { romeMidnight, romeParts } from "../src/lib/rome-time";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SLUG = "salone-demo";
const EMAIL_DOMAIN = "salone-demo.fusionbeauty.demo";

// ── Casualità ripetibile ─────────────────────────────────────────────────────
let seed = 20261125;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const chance = (p: number) => rand() < p;
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

// ── Date in ora italiana ─────────────────────────────────────────────────────
const NOW = new Date();
const TODAY = romeParts(NOW);
/** Istante italiano: giorno relativo a oggi, ore e minuti. */
function at(dayOffset: number, hour: number, minute = 0) {
  return new Date(romeMidnight(TODAY.year, TODAY.month, TODAY.day + dayOffset).getTime() + (hour * 60 + minute) * 60_000);
}
/** 1 = lunedì … 7 = domenica, come gli orari di lavoro. */
function dayOfWeek(dayOffset: number) {
  const d = new Date(Date.UTC(TODAY.year, TODAY.month - 1, TODAY.day + dayOffset, 12));
  return ((d.getUTCDay() + 6) % 7) + 1;
}
const addMin = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

// ── Catalogo ─────────────────────────────────────────────────────────────────
type Svc = { key: string; name: string; description: string; price: number; minutes: number; online?: boolean };
const SERVICES: Svc[] = [
  { key: "piega_corta", name: "Piega capelli corti", description: "Shampoo e piega con phon o spazzola.", price: 20, minutes: 30 },
  { key: "piega_lunga", name: "Piega capelli lunghi", description: "Shampoo, maschera e piega mossa o liscia.", price: 28, minutes: 45 },
  { key: "taglio_donna", name: "Taglio donna + piega", description: "Consulenza, taglio e piega.", price: 48, minutes: 60 },
  { key: "taglio_uomo", name: "Taglio uomo", description: "Taglio forbice e macchinetta, shampoo incluso.", price: 22, minutes: 30 },
  { key: "barba", name: "Barba e rifinitura", description: "Regolazione barba con panno caldo.", price: 15, minutes: 20 },
  { key: "colore", name: "Colore + piega", description: "Colore radici o completo, shampoo e piega.", price: 65, minutes: 90 },
  { key: "balayage", name: "Balayage + piega", description: "Schiariture a mano libera, tonalizzante e piega.", price: 140, minutes: 180 },
  { key: "meches", name: "Meches / colpi di sole", description: "Schiariture con cartine, tonalizzante e piega.", price: 95, minutes: 120 },
  { key: "gloss", name: "Gloss tonalizzante", description: "Riflesso e lucentezza, da abbinare alla piega.", price: 30, minutes: 30 },
  { key: "cheratina", name: "Trattamento cheratina lisciante", description: "Lisciatura alla cheratina, dura 3-4 mesi.", price: 150, minutes: 150 },
  { key: "olaplex", name: "Ricostruzione Olaplex", description: "Trattamento ristrutturante per capelli trattati.", price: 45, minutes: 45 },
  { key: "permanente", name: "Permanente morbida", description: "Onde naturali, con piega.", price: 80, minutes: 120 },
  { key: "sposa", name: "Acconciatura sposa", description: "Prova inclusa, raccolto o semiraccolto.", price: 180, minutes: 120, online: false },
  { key: "cerimonia", name: "Acconciatura cerimonia", description: "Raccolto o onde per eventi.", price: 60, minutes: 60 },
  { key: "manicure", name: "Manicure semipermanente", description: "Preparazione unghie e smalto semipermanente.", price: 35, minutes: 45 },
  { key: "pedicure", name: "Pedicure estetico", description: "Pedicure completo con smalto.", price: 40, minutes: 50 },
  { key: "sopracciglia", name: "Sopracciglia", description: "Definizione con pinzetta o cera.", price: 12, minutes: 15 },
];

// ── Staff ────────────────────────────────────────────────────────────────────
type Staff = { key: string; firstName: string; lastName: string; role: "ADMIN" | "OPERATOR"; does: string[]; days: number[]; perDay: [number, number] };
const HAIR_WOMEN = ["piega_corta", "piega_lunga", "taglio_donna", "colore", "gloss", "olaplex", "cerimonia", "sposa", "permanente"];
const STAFF: Staff[] = [
  { key: "sara", firstName: "Sara", lastName: "Galli", role: "ADMIN", does: [...HAIR_WOMEN, "balayage", "meches", "cheratina"], days: [2, 3, 4, 5, 6], perDay: [4, 6] },
  { key: "chiara", firstName: "Chiara", lastName: "Fontana", role: "OPERATOR", does: [...HAIR_WOMEN, "cheratina"], days: [2, 3, 4, 5, 6], perDay: [5, 7] },
  { key: "martina", firstName: "Martina", lastName: "Greco", role: "OPERATOR", does: [...HAIR_WOMEN, "balayage", "meches"], days: [2, 3, 5, 6], perDay: [3, 5] },
  { key: "davide", firstName: "Davide", lastName: "Rinaldi", role: "OPERATOR", does: ["taglio_uomo", "barba", "piega_corta"], days: [2, 3, 4, 5, 6], perDay: [6, 9] },
  { key: "elisa", firstName: "Elisa", lastName: "Marino", role: "OPERATOR", does: ["manicure", "pedicure", "sopracciglia"], days: [3, 4, 5, 6], perDay: [4, 7] },
];

// Quanto spesso ogni trattamento viene prenotato (peso), per operatrice.
const WEIGHTS: Record<string, number> = {
  piega_corta: 5, piega_lunga: 6, taglio_donna: 5, colore: 5, gloss: 1, olaplex: 2, cerimonia: 1, sposa: 0.2,
  permanente: 0.5, balayage: 2, meches: 2, cheratina: 1, taglio_uomo: 6, barba: 3, manicure: 5, pedicure: 3, sopracciglia: 2,
};
function weightedService(does: string[]) {
  const total = does.reduce((s, k) => s + WEIGHTS[k], 0);
  let r = rand() * total;
  for (const k of does) {
    r -= WEIGHTS[k];
    if (r <= 0) return k;
  }
  return does[0];
}

// ── Clienti ──────────────────────────────────────────────────────────────────
const WOMEN = ["Giulia", "Francesca", "Alessia", "Valentina", "Elena", "Federica", "Silvia", "Laura", "Paola", "Roberta", "Anna", "Marta", "Ilaria", "Beatrice", "Camilla", "Sofia", "Aurora", "Greta", "Noemi", "Serena", "Cristina", "Barbara", "Monica", "Daniela", "Simona", "Eleonora", "Veronica", "Arianna", "Michela", "Claudia", "Rebecca", "Ginevra", "Lucia", "Teresa", "Irene", "Debora", "Manuela", "Alice", "Nicole", "Martina"];
const MEN = ["Marco", "Luca", "Andrea", "Matteo", "Stefano", "Alessandro", "Simone", "Davide", "Lorenzo", "Fabio", "Riccardo", "Paolo", "Giorgio", "Tommaso", "Federico"];
const SURNAMES = ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone", "Longo", "Gentile", "Martinelli", "Vitale", "Serra", "Coppola", "De Santis", "D'Angelo", "Marchetti", "Parisi", "Villa", "Conte", "Ferraro", "Fabbri", "Bianco", "Marini", "Grasso", "Valentini", "Messina", "Sala", "De Angelis"];
const CITIES = ["Milano", "Monza", "Sesto San Giovanni", "Cinisello Balsamo", "Cologno Monzese", "Lissone", "Desio", "Brugherio"];
const SOURCES = ["Passaparola", "Instagram", "Google", "Facebook", "Passaggio davanti al salone", "Treatwell", "Sito web"];
const HAIR_NOTES = [
  "Formula colore: 6.3 + 7.31 (1:1), ossidante 20 vol, posa 35 min.",
  "Capelli fini, evitare prodotti pesanti. Preferisce piega mossa.",
  "Cute sensibile: fare sempre test allergico prima del colore.",
  "Porta sempre la foto del taglio che vuole. Frangia a tendina.",
  "Balayage caramello, tonalizzante 9.13. Rinnovo ogni 3 mesi.",
  "Capelli ricci, usare diffusore. Niente piastra.",
  "Gradisce caffè d'orzo. Parcheggia nel cortile.",
  "Viene sempre il sabato mattina presto.",
  "Allergia al nichel: attenzione ai fermagli metallici.",
  "Copertura bianchi 30%: 5.0 + 5.1, ossidante 20 vol.",
];
const MEN_NOTES = ["Sfumatura alta, 2 ai lati. Barba corta.", "Taglio classico a forbice, riga a sinistra.", "Ogni 3 settimane, preferisce Davide."];
const INTERESTS = ["Colore", "Balayage", "Cheratina", "Sposa", "Unghie", "Trattamenti capelli", "Uomo"];

const pad = (n: number) => String(n).padStart(2, "0");

async function wipeDemo() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) return;
  const tenantId = tenant.id;
  // Le relazioni "Restrict" (pagamenti, consensi → appuntamenti/clienti) vanno tolte prima del centro.
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.consentRecord.deleteMany({ where: { tenantId } });
  await prisma.paymentLink.deleteMany({ where: { tenantId } });
  await prisma.appointment.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  console.log("Centro demo precedente cancellato.");
}

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) throw new Error("Imposta DEMO_PASSWORD (almeno 8 caratteri).");

  await wipeDemo();
  const passwordHash = await bcrypt.hash(password, 10);

  // ── Centro ────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      name: "Salone Demo",
      slug: SLUG,
      phone: "+39 02 0000 0000",
      email: `info@${EMAIL_DOMAIN}`,
      paymentsEnabled: true,
      consentsEnabled: true,
      onlineBookingEnabled: true,
      autoConfirmOnline: false,
    },
  });
  const tenantId = tenant.id;

  // ── Trattamenti ───────────────────────────────────────────────────────────
  const svc: Record<string, { id: string; name: string; price: number; minutes: number }> = {};
  for (const s of SERVICES) {
    const row = await prisma.service.create({
      data: { tenantId, name: s.name, description: s.description, price: s.price, durationMinutes: s.minutes, isOnlineBookingEnabled: s.online ?? true },
    });
    svc[s.key] = { id: row.id, name: s.name, price: s.price, minutes: s.minutes };
  }

  // ── Staff, orari, trattamenti che non fanno ───────────────────────────────
  const staff: Record<string, { id: string; def: Staff }> = {};
  for (const [order, def] of STAFF.entries()) {
    const excluded = SERVICES.filter((s) => !def.does.includes(s.key)).map((s) => ({ id: svc[s.key].id }));
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `${def.key}@${EMAIL_DOMAIN}`,
        passwordHash,
        firstName: def.firstName,
        lastName: def.lastName,
        role: def.role,
        agendaOrder: order,
        excludedServices: { connect: excluded },
      },
    });
    staff[def.key] = { id: user.id, def };
    await prisma.workingHours.createMany({
      data: def.days.flatMap((dayOfWeek) => [
        { tenantId, userId: user.id, dayOfWeek, startTime: "09:00", endTime: "13:00" },
        { tenantId, userId: user.id, dayOfWeek, startTime: "14:00", endTime: dayOfWeek === 6 ? "18:00" : "19:00" },
      ]),
    });
  }

  // Impegni dello staff in agenda.
  const nextTuesday = [1, 2, 3, 4, 5, 6, 7].find((d) => dayOfWeek(d) === 2)!;
  await prisma.staffBlock.createMany({
    data: [
      { tenantId, userId: staff.martina.id, startTime: at(nextTuesday, 9), endTime: at(nextTuesday, 13), title: "Corso colore", note: "Aggiornamento tecniche di schiaritura" },
      { tenantId, userId: staff.chiara.id, startTime: at(0, 13), endTime: at(0, 14), title: "Pausa pranzo" },
      { tenantId, userId: staff.davide.id, startTime: at(2, 17), endTime: at(2, 19), title: "Visita medica" },
    ],
  });
  await prisma.staffException.create({
    data: { tenantId, userId: staff.elisa.id, date: new Date(Date.UTC(TODAY.year, TODAY.month - 1, TODAY.day + 9)), note: "Ferie" },
  });

  // ── Clienti ───────────────────────────────────────────────────────────────
  type ClientRow = { id: string; firstName: string; lastName: string; phone: string; male: boolean; loyalty: number; createdAt: Date; marketing: boolean };
  const clients: ClientRow[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < 82; i++) {
    const male = i % 6 === 5;
    let firstName = "";
    let lastName = "";
    do {
      firstName = male ? pick(MEN) : pick(WOMEN);
      lastName = pick(SURNAMES);
    } while (usedNames.has(`${firstName} ${lastName}`));
    usedNames.add(`${firstName} ${lastName}`);

    const phone = `+39 3${int(20, 49)} 555 ${pad(int(0, 99))}${pad(i)}`;
    // Data di nascita: alcune con il compleanno oggi e nei prossimi giorni (per auguri e campagne).
    const birthOffset = i < 2 ? 0 : i < 5 ? int(1, 6) : null;
    const birthYear = int(1965, 2003);
    const dateOfBirth =
      birthOffset !== null
        ? new Date(Date.UTC(birthYear, TODAY.month - 1, TODAY.day + birthOffset))
        : chance(0.75)
          ? new Date(Date.UTC(birthYear, int(0, 11), int(1, 28)))
          : null;
    // Prima visita: chi da più di 4 mesi (storico), alcune nuove nelle ultime settimane.
    const createdAt = i >= 72 ? at(-int(3, 25), 10) : at(-int(130, 700), 11);
    const loyalty = i >= 72 ? 1 : i < 15 ? 3 : i < 50 ? 2 : i < 62 ? 1 : 0; // 0 = non torna da mesi
    const row = await prisma.client.create({
      data: {
        tenantId,
        firstName,
        lastName,
        phone,
        email: chance(0.6) ? `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, "") + "@example.com" : null,
        dateOfBirth,
        city: pick(CITIES),
        acquisitionSource: pick(SOURCES),
        notes: male ? pick(MEN_NOTES) : chance(0.7) ? pick(HAIR_NOTES) : null,
        allergies: chance(0.08) ? "PPD (parafenilendiammina): solo colori senza ammoniaca e PPD." : null,
        interests: male ? ["Uomo"] : [...new Set([pick(INTERESTS.slice(0, 6)), ...(chance(0.4) ? [pick(INTERESTS.slice(0, 6))] : [])])],
        googleReviewAt: chance(0.3) ? at(-int(10, 200), 18) : null,
        createdAt,
      },
    });
    clients.push({ id: row.id, firstName, lastName, phone, male, loyalty, createdAt, marketing: chance(0.75) });
  }
  const women = clients.filter((c) => !c.male);
  const men = clients.filter((c) => c.male);

  // ── Consensi ──────────────────────────────────────────────────────────────
  const privacy = await prisma.consentTemplate.create({
    data: {
      tenantId,
      type: "PRIVACY_GDPR",
      title: "Informativa privacy (GDPR)",
      body: "Il Salone Demo tratta i tuoi dati (nome, telefono, storico trattamenti) solo per gestire appuntamenti e servizi, secondo il Regolamento UE 2016/679. Puoi chiedere in ogni momento di vederli, correggerli o cancellarli.",
    },
  });
  const marketing = await prisma.consentTemplate.create({
    data: {
      tenantId,
      type: "MARKETING",
      title: "Consenso promozioni WhatsApp",
      body: "Acconsento a ricevere su WhatsApp promozioni, auguri e novità del Salone Demo. Posso revocare il consenso in qualsiasi momento.",
    },
  });
  const colourConsent = await prisma.consentTemplate.create({
    data: {
      tenantId,
      type: "TREATMENT",
      title: "Consenso informato — colorazione e schiariture",
      body: "Dichiaro di essere stata informata che i prodotti per colorazione e schiaritura possono causare reazioni allergiche e che è consigliato un test 48 ore prima. Confermo le informazioni sul mio stato di salute riportate qui sotto.",
      checklist: ["Allergie note a tinture o PPD", "Reazioni a colorazioni precedenti", "Gravidanza o allattamento", "Cute irritata o con lesioni", "Trattamenti dermatologici in corso"],
      services: { connect: ["colore", "balayage", "meches", "gloss", "permanente"].map((k) => ({ id: svc[k].id })) },
    },
  });
  const keratinConsent = await prisma.consentTemplate.create({
    data: {
      tenantId,
      type: "TREATMENT",
      title: "Consenso informato — trattamento lisciante",
      body: "Sono stata informata su modalità, durata e cure successive del trattamento lisciante alla cheratina e sui possibili effetti su capelli molto trattati.",
      checklist: ["Gravidanza o allattamento", "Asma o problemi respiratori", "Decolorazioni nelle ultime 2 settimane"],
      services: { connect: [{ id: svc.cheratina.id }] },
    },
  });
  const consentRows = [];
  for (const c of clients) {
    if (chance(0.9)) {
      const signedAt = addMin(c.createdAt, 15);
      consentRows.push({
        tenantId, clientId: c.id, templateId: privacy.id, collectedById: staff.sara.id, status: "SIGNED" as const,
        templateVersion: 1, titleSnapshot: privacy.title, bodySnapshot: privacy.body, signedAt, createdAt: signedAt,
      });
      consentRows.push({
        tenantId, clientId: c.id, templateId: marketing.id, collectedById: staff.sara.id, status: "SIGNED" as const,
        templateVersion: 1, titleSnapshot: marketing.title, bodySnapshot: marketing.body, granted: c.marketing, signedAt, createdAt: signedAt,
      });
    }
  }
  await prisma.consentRecord.createMany({ data: consentRows });

  // ── Agenda: 4 mesi di storico, oggi e le prossime 3 settimane ──────────────
  type Appt = {
    id: string; tenantId: string; clientId: string; serviceId: string; operatorId: string; startTime: Date; endTime: Date;
    status: "BOOKED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"; source: "INTERNAL" | "ONLINE"; notes: string | null; createdAt: Date;
  };
  const appointments: Appt[] = [];
  const payments: { tenantId: string; clientId: string; appointmentId: string; amount: number; method: "CASH" | "CARD" | "TRANSFER"; paidAt: Date; createdById: string; notes?: string }[] = [];
  const extras: { appointmentId: string; serviceId: string; position: number; price: number; durationMinutes: number; startTime: Date }[] = [];

  // Clienti più fedeli escono più spesso; quelle "perse" solo nella parte vecchia dello storico.
  function clientFor(staffKey: string, dayOffset: number) {
    const pool = staffKey === "davide" ? men : women;
    for (let tries = 0; tries < 30; tries++) {
      const c = pick(pool);
      if (c.createdAt > at(dayOffset, 8)) continue;
      if (c.loyalty === 0 && dayOffset > -75) continue;
      if (rand() < [0.15, 0.45, 0.75, 1][c.loyalty]) return c;
    }
    return pick(pool.filter((c) => c.createdAt <= at(dayOffset, 8) && c.loyalty > 0)) ?? pick(pool);
  }

  const nowMs = NOW.getTime();
  for (let day = -120; day <= 21; day++) {
    const dow = dayOfWeek(day);
    const future = day > 0;
    for (const { id: operatorId, def } of Object.values(staff)) {
      if (!def.days.includes(dow)) continue;
      // In futuro l'agenda si riempie man mano che ci si avvicina.
      const fill = !future ? 1 : day <= 3 ? 0.9 : day <= 7 ? 0.65 : day <= 14 ? 0.4 : 0.2;
      const target = Math.round(int(def.perDay[0], def.perDay[1]) * fill);
      let cursor = at(day, 9, pick([0, 0, 15, 30]));
      const close = at(day, dow === 6 ? 18 : 19);
      let made = 0;
      while (made < target) {
        // Pausa pranzo.
        if (cursor < at(day, 14) && cursor >= at(day, 13)) cursor = at(day, 14);
        const key = weightedService(def.does);
        const s = svc[key];
        // Colore spesso con un trattamento in più (Olaplex o gloss).
        const extraKey = (key === "colore" || key === "balayage" || key === "meches") && chance(0.3) ? pick(["olaplex", "gloss"]) : null;
        const extra = extraKey ? svc[extraKey] : null;
        const total = s.minutes + (extra?.minutes ?? 0);
        let start = cursor;
        if (start < at(day, 13) && addMin(start, total) > at(day, 13) && total <= 60) start = at(day, 14);
        const end = addMin(start, total);
        if (end > close) break;

        const client = clientFor(def.key, day);
        const isPast = end.getTime() < nowMs;
        let status: Appt["status"];
        if (isPast) status = chance(0.03) ? "NO_SHOW" : chance(0.04) ? "CANCELLED" : "COMPLETED";
        else status = day <= 2 ? (chance(0.85) ? "CONFIRMED" : "BOOKED") : chance(0.5) ? "CONFIRMED" : "BOOKED";
        const online = !isPast && day >= 1 && chance(0.15);
        const id = randomUUID();
        const createdAt = online ? at(-int(0, 5), int(8, 22), int(0, 59)) : new Date(Math.min(start.getTime(), nowMs) - int(1, 20) * 86_400_000);
        appointments.push({
          id, tenantId, clientId: client.id, serviceId: s.id, operatorId, startTime: start, endTime: end, status,
          source: online ? "ONLINE" : "INTERNAL",
          notes: key === "sposa" ? "Matrimonio: prova fatta, raccolto basso con fiori freschi." : chance(0.05) ? "Arriva 10 minuti prima per il test colore." : null,
          createdAt: createdAt.getTime() > start.getTime() ? addMin(start, -60 * 24) : createdAt,
        });
        if (extra) extras.push({ appointmentId: id, serviceId: extra.id, position: 1, price: extra.price, durationMinutes: extra.minutes, startTime: addMin(start, s.minutes) });

        // Incasso: tutto il passato, tranne un paio di appuntamenti di oggi ancora da incassare.
        if (status === "COMPLETED" && !(day === 0 && chance(0.35))) {
          const amount = s.price + (extra?.price ?? 0);
          payments.push({
            tenantId, clientId: client.id, appointmentId: id, amount,
            method: chance(0.62) ? "CARD" : chance(0.95) ? "CASH" : "TRANSFER",
            paidAt: addMin(end, int(0, 10)), createdById: def.key === "sara" ? staff.sara.id : operatorId,
          });
        }
        made++;
        cursor = addMin(end, pick([0, 0, 0, 15, 15, 30, 45]));
      }
    }
  }

  // Richieste online ancora da confermare (pagina Richieste).
  const requestSlots: [number, number, string, string][] = [
    [1, 16, "chiara", "taglio_donna"],
    [3, 10, "martina", "balayage"],
    [4, 15, "elisa", "manicure"],
  ];
  for (const [day, hour, staffKey, key] of requestSlots) {
    const start = at(day, hour);
    const end = addMin(start, svc[key].minutes);
    const operatorId = staff[staffKey].id;
    if (!staff[staffKey].def.days.includes(dayOfWeek(day))) continue;
    if (appointments.some((a) => a.operatorId === operatorId && a.startTime < end && a.endTime > start)) continue;
    appointments.push({
      id: randomUUID(), tenantId, clientId: pick(women.filter((c) => c.loyalty >= 1)).id, serviceId: svc[key].id, operatorId,
      startTime: start, endTime: end, status: "BOOKED", source: "ONLINE", notes: "Prenotato dal sito.", createdAt: at(0, 7, int(0, 59)),
    });
  }

  for (let i = 0; i < appointments.length; i += 500) {
    await prisma.appointment.createMany({ data: appointments.slice(i, i + 500) });
  }
  for (let i = 0; i < extras.length; i += 500) {
    await prisma.appointmentExtraService.createMany({ data: extras.slice(i, i + 500) });
  }
  for (let i = 0; i < payments.length; i += 500) {
    await prisma.payment.createMany({ data: payments.slice(i, i + 500) });
  }

  // Consensi colore firmati al primo appuntamento di colore.
  const colourIds = new Set(["colore", "balayage", "meches"].map((k) => svc[k].id));
  const firstColour = new Map<string, Appt>();
  for (const a of [...appointments].sort((x, y) => x.startTime.getTime() - y.startTime.getTime())) {
    if (colourIds.has(a.serviceId) && a.status === "COMPLETED" && !firstColour.has(a.clientId)) firstColour.set(a.clientId, a);
  }
  await prisma.consentRecord.createMany({
    data: [...firstColour.values()].map((a) => ({
      tenantId, clientId: a.clientId, appointmentId: a.id, templateId: colourConsent.id, collectedById: a.operatorId, status: "SIGNED" as const,
      templateVersion: 1, titleSnapshot: colourConsent.title, bodySnapshot: colourConsent.body,
      answers: { conditions: [], none: true, note: "Test allergico eseguito 48 ore prima: negativo." }, signedAt: addMin(a.startTime, -5), createdAt: addMin(a.startTime, -5),
    })),
  });
  void keratinConsent; // Resta da firmare: in agenda compare l'avviso "Consenso".

  // ── Percorsi (pacchetti di sedute) ────────────────────────────────────────
  const planDefs = [
    { name: "Percorso ricostruzione Olaplex — 5 sedute", sessions: 5, price: 200, done: 3, paid: 120 },
    { name: "Pacchetto 10 pieghe", sessions: 10, price: 220, done: 6, paid: 220 },
    { name: "Percorso sposa (prova + giorno)", sessions: 2, price: 230, done: 1, paid: 100 },
  ];
  for (const [i, p] of planDefs.entries()) {
    const client = women[i * 3];
    const plan = await prisma.clientPlan.create({
      data: {
        tenantId, clientId: client.id, name: p.name, totalSessions: p.sessions, totalPrice: p.price, paidAmount: p.paid,
        notes: i === 2 ? "Matrimonio a giugno. Raccolto con velo." : null,
        sessions: {
          create: Array.from({ length: p.sessions }, (_, n) => ({
            sessionNumber: n + 1,
            completedAt: n < p.done ? at(-(p.done - n) * 14, 11) : null,
          })),
        },
      },
    });
    await prisma.payment.create({
      data: { tenantId, clientId: client.id, planId: plan.id, amount: p.paid, method: "CARD", paidAt: at(-p.done * 14, 11), createdById: staff.sara.id, notes: "Acconto percorso" },
    });
  }

  // ── Automazioni ───────────────────────────────────────────────────────────
  const tpl = (id: string, templateName: string, templateBody: string, params: string[]) => ({ id, type: "SEND_TEMPLATE", templateName, language: "it", templateBody, params });
  const automationDefs = [
    {
      name: "Promemoria del giorno prima", trigger: "BEFORE_APPOINTMENT" as const, triggerConfig: { hours: 24 }, presetKey: "reminder",
      steps: [tpl("invio", "promemoria_appuntamento", "Ciao {{1}}, ti ricordiamo l'appuntamento di domani alle {{2}} per {{3}}. Ti aspettiamo!", ["{{nome}}", "{{ora}}", "{{trattamento}}"])],
    },
    {
      name: "Conferma appuntamento", trigger: "APPOINTMENT_CONFIRMED" as const, triggerConfig: {}, presetKey: "booking_confirmed",
      steps: [tpl("invio", "conferma_appuntamento", "Ciao {{1}}, ti confermiamo {{2}} il {{3}} alle {{4}}. A presto dal Salone Demo!", ["{{nome}}", "{{trattamento}}", "{{data}}", "{{ora}}"])],
    },
    {
      name: "Richiesta online ricevuta", trigger: "BOOKING_REQUESTED" as const, triggerConfig: {}, presetKey: "booking_request",
      steps: [tpl("invio", "richiesta_ricevuta", "Ciao {{1}}, abbiamo ricevuto la tua richiesta per {{2}} il {{3}} alle {{4}}. Ti confermiamo a breve!", ["{{nome}}", "{{trattamento}}", "{{data}}", "{{ora}}"])],
    },
    {
      name: "Dopo il trattamento: recensione e richiamo", trigger: "AFTER_APPOINTMENT" as const, triggerConfig: { hours: 24 }, presetKey: "after_treatment",
      steps: [
        {
          id: "recensione", type: "CONDITION", condition: { field: "GOOGLE_REVIEW_LEFT" },
          then: [],
          else: [tpl("grazie", "grazie_recensione", "Ciao {{1}}, com'è andata ieri? Se ti sei trovata bene, una recensione su Google ci aiuta tanto: {{2}}", ["{{nome}}", "https://g.page/r/salone-demo/review"])],
        },
        { id: "attesa", type: "WAIT", amount: 35, unit: "days" },
        {
          id: "se", type: "CONDITION", condition: { field: "HAS_FUTURE_APPOINTMENT" },
          then: [],
          else: [tpl("richiamo", "richiamo_prossimo", "Ciao {{1}}, è passato un po' dall'ultima volta: vuoi fissare il prossimo appuntamento? Prenota qui {{2}}", ["{{nome}}", "{{prenota}}"])],
        },
      ],
    },
    {
      name: "Colore: ritocco radici dopo 5 settimane", trigger: "AFTER_APPOINTMENT" as const, triggerConfig: { hours: 24 * 35, serviceIds: [svc.colore.id] }, presetKey: null,
      steps: [
        {
          id: "se", type: "CONDITION", condition: { field: "HAS_FUTURE_APPOINTMENT" },
          then: [],
          else: [
            tpl("radici", "ritocco_radici", "Ciao {{1}}, sono passate 5 settimane dal colore: è il momento giusto per il ritocco radici. Prenota qui {{2}}", ["{{nome}}", "{{prenota}}"]),
            { id: "nota", type: "ADD_NOTE", text: "Inviato promemoria ritocco radici." },
          ],
        },
      ],
    },
    {
      name: "Auguri di compleanno", trigger: "BIRTHDAY" as const, triggerConfig: {}, presetKey: "birthday",
      steps: [tpl("invio", "auguri_compleanno", "Buon compleanno {{1}}! 🎉 Per festeggiare hai il 15% di sconto sul prossimo trattamento entro il {{2}}. Prenota qui: {{3}}", ["{{nome}}", "{{scadenza}}", "{{prenota}}"])],
    },
    {
      name: "Cliente che non torna da 60 giorni", trigger: "CLIENT_INACTIVE" as const, triggerConfig: { days: 60 }, presetKey: "inactive",
      steps: [tpl("invio", "ti_aspettiamo", "Ciao {{1}}, è un po' che non ci vediamo! Ti aspettiamo al Salone Demo: prenota qui {{2}}", ["{{nome}}", "{{prenota}}"])],
    },
    {
      name: "Benvenuta nuova cliente", trigger: "CLIENT_CREATED" as const, triggerConfig: {}, presetKey: "new_client", allowReentry: false,
      steps: [
        tpl("invio", "benvenuta", "Ciao {{1}}, benvenuta al Salone Demo! Per qualsiasi cosa scrivici qui su WhatsApp.", ["{{nome}}"]),
        { id: "interesse", type: "ADD_INTEREST", interest: "Nuova cliente" },
      ],
    },
  ];
  const automations: Record<string, string> = {};
  for (const a of automationDefs) {
    const row = await prisma.automation.create({
      data: {
        tenantId, name: a.name, status: "ACTIVE", trigger: a.trigger, triggerConfig: a.triggerConfig, steps: a.steps, presetKey: a.presetKey,
        allowReentry: a.allowReentry ?? true, stopOnReply: a.trigger === "CLIENT_INACTIVE",
        createdAt: at(-110, 10),
      },
    });
    automations[a.presetKey ?? a.name] = row.id;
  }

  // ── Storico WhatsApp: messaggi automatici, campagna e conversazioni ───────
  const waPhone = (phone: string) => phone.replace(/\D/g, "");
  const fmtDate = (d: Date) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(d);
  const fmtTime = (d: Date) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(d);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const serviceName = new Map(Object.values(svc).map((s) => [s.id, s.name]));

  const messages: { id: string; tenantId: string; clientId: string; phone: string; direction: "INBOUND" | "OUTBOUND"; status: "RECEIVED" | "DELIVERED" | "READ"; body: string; templateName: string | null; readAt: Date | null; createdAt: Date }[] = [];
  const runs: { tenantId: string; automationId: string; clientId: string; status: "COMPLETED"; triggerKey: string; context: object; log: object; createdAt: Date; updatedAt: Date }[] = [];

  // Promemoria del giorno prima per gli appuntamenti delle ultime 3 settimane.
  for (const a of appointments) {
    if (a.startTime < at(-21, 0) || a.startTime > NOW || a.status === "CANCELLED") continue;
    const c = clientById.get(a.clientId)!;
    const sentAt = addMin(a.startTime, -24 * 60);
    const body = `Ciao ${c.firstName}, ti ricordiamo l'appuntamento di domani alle ${fmtTime(a.startTime)} per ${serviceName.get(a.serviceId)}. Ti aspettiamo!`;
    messages.push({ id: randomUUID(), tenantId, clientId: c.id, phone: waPhone(c.phone), direction: "OUTBOUND", status: "READ", body, templateName: "promemoria_appuntamento", readAt: addMin(sentAt, int(2, 90)), createdAt: sentAt });
    runs.push({
      tenantId, automationId: automations.reminder, clientId: c.id, status: "COMPLETED",
      triggerKey: `appointment:${a.id}:${a.startTime.toISOString()}`,
      context: { appointmentId: a.id, vars: { trattamento: serviceName.get(a.serviceId), data: fmtDate(a.startTime), ora: fmtTime(a.startTime) } },
      log: [{ at: sentAt.toISOString(), step: "WhatsApp “promemoria_appuntamento”", ok: true, message: "Inviato." }],
      createdAt: sentAt, updatedAt: sentAt,
    });
    if (chance(0.25)) {
      messages.push({ id: randomUUID(), tenantId, clientId: c.id, phone: waPhone(c.phone), direction: "INBOUND", status: "RECEIVED", body: pick(["Perfetto, a domani! 😊", "Grazie, ci sarò", "Ok grazie!", "Confermo 👍", "Posso arrivare 10 minuti più tardi?"]), templateName: null, readAt: addMin(sentAt, 120), createdAt: addMin(sentAt, int(5, 100)) });
    }
  }
  // Auguri a chi ha compiuto gli anni nell'ultimo mese.
  for (const c of clients.slice(0, 2)) {
    const sentAt = at(0, 9, 5);
    messages.push({ id: randomUUID(), tenantId, clientId: c.id, phone: waPhone(c.phone), direction: "OUTBOUND", status: "DELIVERED", body: `Buon compleanno ${c.firstName}! 🎉 Per festeggiare hai il 15% di sconto sul prossimo trattamento. Prenota qui: https://beauty.fusionsoft.it/embed/${SLUG}`, templateName: "auguri_compleanno", readAt: null, createdAt: sentAt });
    runs.push({ tenantId, automationId: automations.birthday, clientId: c.id, status: "COMPLETED", triggerKey: `birthday:${TODAY.year}:${c.id}`, context: {}, log: [{ at: sentAt.toISOString(), step: "WhatsApp “auguri_compleanno”", ok: true, message: "Inviato." }], createdAt: sentAt, updatedAt: sentAt });
  }
  // Due conversazioni scritte dalle clienti.
  const chats: [ClientRow, [("in" | "out"), string, number][]][] = [
    [women[5], [["in", "Ciao! Avete posto sabato mattina per colore e piega?", -95], ["out", "Ciao! Sabato alle 9:30 con Martina, ti va bene?", -80], ["in", "Perfetto, grazie mille!", -70]]],
    [women[8], [["in", "Buongiorno, quanto costa la cheratina per capelli lunghi?", -30], ["out", "Buongiorno! Parte da 150 €, dura circa 2 ore e mezza. Vuoi che ti fissi una consulenza gratuita?", -20]]],
  ];
  for (const [c, lines] of chats) {
    for (const [dir, body, minutes] of lines) {
      const createdAt = addMin(NOW, minutes);
      messages.push({ id: randomUUID(), tenantId, clientId: c.id, phone: waPhone(c.phone), direction: dir === "in" ? "INBOUND" : "OUTBOUND", status: dir === "in" ? "RECEIVED" : "READ", body, templateName: null, readAt: minutes < -25 ? addMin(createdAt, 3) : null, createdAt });
    }
  }

  // Campagna già inviata e una in bozza.
  const campaign = await prisma.campaign.create({
    data: {
      tenantId, name: "Black Friday — 20% su colore e trattamenti", status: "COMPLETED", templateName: "promo_black_friday", language: "it",
      templateBody: "Ciao {{1}}! Solo questa settimana -20% su colore, balayage e trattamenti ricostruttivi. Prenota qui: {{2}}",
      params: ["{{nome}}", "{{prenota}}"], audience: { segment: "ALL", excludeUpcoming: false, marketingConsentOnly: true },
      startedAt: at(-4, 10), completedAt: at(-4, 11, 30), createdAt: at(-6, 18),
    },
  });
  const recipients = clients.filter((c) => c.marketing && !c.male).slice(0, 45);
  const campaignRows = [];
  for (const c of recipients) {
    const sentAt = at(-4, 10, int(0, 80));
    const messageId = randomUUID();
    messages.push({ id: messageId, tenantId, clientId: c.id, phone: waPhone(c.phone), direction: "OUTBOUND", status: chance(0.7) ? "READ" : "DELIVERED", body: `Ciao ${c.firstName}! Solo questa settimana -20% su colore, balayage e trattamenti ricostruttivi. Prenota qui: https://beauty.fusionsoft.it/embed/${SLUG}`, templateName: "promo_black_friday", readAt: null, createdAt: sentAt });
    campaignRows.push({ campaignId: campaign.id, clientId: c.id, status: "SENT" as const, messageId, sentAt });
    if (chance(0.12)) messages.push({ id: randomUUID(), tenantId, clientId: c.id, phone: waPhone(c.phone), direction: "INBOUND", status: "RECEIVED", body: pick(["Che bello! Vorrei prenotare il balayage", "Vale anche per la cheratina?", "Mi tenete un posto venerdì?"]), templateName: null, readAt: at(-4, 15), createdAt: addMin(sentAt, int(10, 300)) });
  }
  await prisma.campaign.update({ where: { id: campaign.id }, data: { totalRecipients: recipients.length } });
  await prisma.campaign.create({
    data: {
      tenantId, name: "Natale — pacchetto piega + trattamento", status: "DRAFT", templateName: "promo_natale", language: "it",
      templateBody: "Ciao {{1}}, per le feste: piega + trattamento Olaplex a 60 € invece di 73 €. Prenota qui: {{2}}",
      params: ["{{nome}}", "{{prenota}}"], audience: { segment: "INACTIVE", days: 45, excludeUpcoming: true, marketingConsentOnly: true },
    },
  });

  for (let i = 0; i < messages.length; i += 500) {
    await prisma.whatsappMessage.createMany({ data: messages.slice(i, i + 500) });
  }
  await prisma.campaignRecipient.createMany({ data: campaignRows });
  for (let i = 0; i < runs.length; i += 500) {
    await prisma.automationRun.createMany({ data: runs.slice(i, i + 500), skipDuplicates: true });
  }

  const todayCount = appointments.filter((a) => a.startTime >= at(0, 0) && a.startTime < at(1, 0)).length;
  console.log({
    centro: tenant.name,
    accesso: `sara@${EMAIL_DOMAIN} (titolare); operatrici: ${STAFF.slice(1).map((s) => `${s.key}@${EMAIL_DOMAIN}`).join(", ")}`,
    trattamenti: SERVICES.length,
    clienti: clients.length,
    appuntamenti: appointments.length,
    oggi: todayCount,
    incassi: payments.length,
    automazioni: automationDefs.length,
    messaggi: messages.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
