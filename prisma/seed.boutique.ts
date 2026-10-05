import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function upsertService(
  tenantId: string,
  data: { name: string; description: string; price: number; durationMinutes: number }
) {
  const existing = await prisma.service.findFirst({ where: { tenantId, name: data.name } });
  if (existing) return prisma.service.update({ where: { id: existing.id }, data });
  return prisma.service.create({ data: { tenantId, isActive: true, isOnlineBookingEnabled: true, ...data } });
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "boutique-del-benessere" },
    update: { name: "La Boutique del Benessere", phone: "", email: "info@boutique-benessere.it", isActive: true },
    create: {
      name: "La Boutique del Benessere",
      slug: "boutique-del-benessere",
      phone: "",
      email: "info@boutique-benessere.it",
      isActive: true,
    },
  });

  const robertaHash = await bcrypt.hash("KFWB#hRHX!LsSC9", 10);
  const giuliaHash = await bcrypt.hash("7THH#r2cv!rVVi9", 10);

  await prisma.user.upsert({
    where: { email: "roberta@boutique.it" },
    update: { passwordHash: robertaHash, tenantId: tenant.id, isActive: true },
    create: {
      email: "roberta@boutique.it",
      passwordHash: robertaHash,
      firstName: "Roberta",
      lastName: "",
      role: "ADMIN",
      tenantId: tenant.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "giulia@boutique.it" },
    update: { passwordHash: giuliaHash, tenantId: tenant.id, isActive: true },
    create: {
      email: "giulia@boutique.it",
      passwordHash: giuliaHash,
      firstName: "Giulia",
      lastName: "",
      role: "OPERATOR",
      tenantId: tenant.id,
      isActive: true,
    },
  });

  const services = [
    // DIAGNOSI VISO
    { name: "Diagnosi viso", description: "Analisi approfondita della pelle del viso", price: 40, durationMinutes: 30 },
    { name: "Diagnosi corpo", description: "Analisi e valutazione corporea", price: 40, durationMinutes: 30 },
    // VISO
    { name: "Igiene cosmetica", description: "Pulizia del viso classica", price: 55, durationMinutes: 60 },
    { name: "Igiene tripla esfogliazione", description: "Pulizia del viso con tripla esfogliazione", price: 70, durationMinutes: 60 },
    { name: "Trattamento funzionale", description: "Trattamento viso funzionale personalizzato", price: 75, durationMinutes: 60 },
    { name: "Trattamento specifico", description: "Trattamento viso specifico per problematiche", price: 85, durationMinutes: 60 },
    { name: "Trattamento K-Peel", description: "Peeling chimico K-Peel", price: 90, durationMinutes: 60 },
    { name: "Trattamento intensivo/urto", description: "Trattamento viso intensivo ad effetto urto", price: 90, durationMinutes: 60 },
    { name: "Perfect contour", description: "Ridefinizione ovale e contorno viso", price: 70, durationMinutes: 60 },
    // CORPO
    { name: "Rinnovamento cellulare", description: "Trattamento corpo per il rinnovamento cellulare", price: 70, durationMinutes: 60 },
    { name: "Massaggio", description: "Massaggio corpo rilassante o decontratturante", price: 55, durationMinutes: 60 },
    { name: "Trattamento corpo specifico", description: "Trattamento corpo su problematiche specifiche", price: 70, durationMinutes: 60 },
    { name: "Trattamento urto corpo", description: "Trattamento corpo ad effetto urto intensivo", price: 85, durationMinutes: 60 },
    // MANI
    { name: "Manicure", description: "Manicure classica", price: 20, durationMinutes: 30 },
    { name: "Manicure semipermanente", description: "Manicure con smalto semipermanente", price: 35, durationMinutes: 50 },
    { name: "Ricostruzione soft gel tip", description: "Ricostruzione unghie in soft gel tip", price: 50, durationMinutes: 65 },
    { name: "Riparazione unghia", description: "Riparazione singola unghia", price: 5, durationMinutes: 10 },
    // PIEDI
    { name: "Pedicure", description: "Pedicure classica", price: 28, durationMinutes: 40 },
    { name: "Pedispa", description: "Pedicure con bagno spa", price: 43, durationMinutes: 50 },
    { name: "Pedicure semipermanente", description: "Pedicure con smalto semipermanente", price: 40, durationMinutes: 60 },
    // EPILAZIONE DONNA
    { name: "Epilazione total body donna", description: "Epilazione integrale donna", price: 70, durationMinutes: 70 },
    { name: "Epilazione gamba completa", description: "Epilazione gamba intera", price: 25, durationMinutes: 30 },
    { name: "Epilazione mezza gamba / braccia", description: "Epilazione mezza gamba o braccia", price: 17, durationMinutes: 20 },
    { name: "Epilazione piccole zone", description: "Epilazione piccole zone (labbro, ascelle, inguine...)", price: 10, durationMinutes: 10 },
    // LAMINAZIONE
    { name: "Laminazione ciglia o sopracciglia", description: "Laminazione e definizione ciglia o sopracciglia", price: 60, durationMinutes: 60 },
    // LASER 808
    { name: "Laser 808 — Inguine", description: "Epilazione laser 808 inguine", price: 30, durationMinutes: 30 },
    { name: "Laser 808 — Ascelle", description: "Epilazione laser 808 ascelle", price: 25, durationMinutes: 30 },
    { name: "Laser 808 — Inguine + Ascelle", description: "Epilazione laser 808 inguine e ascelle", price: 45, durationMinutes: 45 },
    { name: "Laser 808 — Mezza gamba", description: "Epilazione laser 808 mezza gamba", price: 45, durationMinutes: 45 },
    { name: "Laser 808 — Mezza gamba + Inguine", description: "Epilazione laser 808 mezza gamba e inguine", price: 65, durationMinutes: 60 },
    { name: "Laser 808 — Gamba totale", description: "Epilazione laser 808 gamba intera", price: 80, durationMinutes: 60 },
    { name: "Laser 808 — Gamba totale + Inguine", description: "Epilazione laser 808 gamba totale e inguine", price: 95, durationMinutes: 75 },
    { name: "Laser 808 — Braccia", description: "Epilazione laser 808 braccia", price: 35, durationMinutes: 30 },
    { name: "Laser 808 — Petto uomo", description: "Epilazione laser 808 petto uomo", price: 35, durationMinutes: 30 },
    { name: "Laser 808 — Schiena uomo", description: "Epilazione laser 808 schiena uomo", price: 35, durationMinutes: 30 },
    { name: "Laser 808 — Baffetto", description: "Epilazione laser 808 baffetto", price: 12, durationMinutes: 15 },
    { name: "Laser 808 — Baffetto + Mento", description: "Epilazione laser 808 baffetto e mento", price: 20, durationMinutes: 20 },
    { name: "Laser 808 — Baffetto + Mento + Basette", description: "Epilazione laser 808 baffetto, mento e basette", price: 30, durationMinutes: 25 },
    { name: "Laser 808 — Zona piccola", description: "Epilazione laser 808 zona piccola", price: 39, durationMinutes: 20 },
    { name: "Laser 808 — Zona grande", description: "Epilazione laser 808 zona grande", price: 45, durationMinutes: 30 },
    { name: "Laser 808 — Zone viso", description: "Epilazione laser 808 zone viso", price: 25, durationMinutes: 20 },
    // EPILAZIONE UOMO
    { name: "Epilazione total body uomo", description: "Epilazione integrale uomo", price: 100, durationMinutes: 95 },
    { name: "Epilazione gamba completa uomo", description: "Epilazione gamba intera uomo", price: 35, durationMinutes: 40 },
    { name: "Epilazione braccia uomo", description: "Epilazione braccia uomo", price: 20, durationMinutes: 15 },
    { name: "Epilazione addome uomo", description: "Epilazione addome uomo", price: 35, durationMinutes: 20 },
    { name: "Epilazione schiena uomo", description: "Epilazione schiena uomo", price: 35, durationMinutes: 20 },
    { name: "Epilazione piccole zone uomo", description: "Epilazione piccole zone uomo", price: 8, durationMinutes: 5 },
  ];

  for (const service of services) {
    await upsertService(tenant.id, service);
  }

  // Consenso informato Laser 808
  const laser808Body = `DICHIARO

Che attraverso questo documento RICHIEDO ED AUTORIZZO il personale de La Boutique del Benessere ad effettuare sulla mia persona il trattamento di epilazione con LASER, che si dettaglia come segue:

BREVE SPIEGAZIONE DEL TRATTAMENTO
La Boutique del Benessere utilizza un apparato laser impulsato, progettato e costruito per l'impiego nel settore estetico e opportunamente defocalizzato esclusivamente per i trattamenti di depilazione. L'interazione laser-bulbo pilifero è essenzialmente termica. Il processo, noto come "fototermolisi selettiva", richiede un certo numero di sedute (tipicamente all'incirca 10).

CONTROINDICAZIONI
Possono includere: pace-maker, patologie cardiache, patologie della pelle, epilessia, asma, trattamenti medici fotosensibilizzanti, gravidanza o allattamento, diabete, processi maligni, recente esposizione solare, uso di farmaci fotosensibilizzanti. Inoltre sono stato informato che devo comunicare al personale del Centro il consumo di qualunque sostanza farmacologica ed il cambiamento del mio stato basale (gravidanza, malattie, allergie...). E' sconsigliato, ugualmente, sulla pelle molto abbronzata o che si stia per sottoporre ai raggi UVA, presenza di tatuaggi, nevi in rilievo, aumentando in questo caso il rischio di bruciature. Nel caso di trattamento al seno: allattamento, mastopatia fibrocistica, noduli, protesi.

Normalmente il trattamento non è doloroso e non presenta complicazioni, però comprendo la possibilità di "effetti secondari" che si producono raramente, come la comparsa di zone di Ipo ed Iper pigmentazione temporanea, bruciature superficiali temporanee, arrossamenti, cicatrici ed eruzioni acneiformi, come conseguenza di un effetto termico passeggero.

RISCHI INERENTI IL CLIENTE E LE SUE CIRCOSTANZE PERSONALI
Sono stato informato che dopo il trattamento è normale che la zona presenti un eritema od un edema, di solito leggero, o una piccola vescicola intradermica. Nella norma questi effetti durano solo poche ore anche se in alcuni casi possono essere più persistenti. Soprattutto il rischio è maggiore per le pelli scure o che sono state esposte al sole recentemente, in quanto la presenza di melanina è maggiore. Inoltre può presentarsi un cambio di pigmentazione (ipo o iper) che in generale è transitorio, e che trattato adeguatamente sparisce in poco tempo.

CONFERMO
Che il trattamento menzionato, mi è stato spiegato a fondo, da un professionista (operatore estetico) con parole comprensibili per me, i rischi che presenta, gli effetti indesiderati, i rischi caratteristici della mia persona, così come i disturbi o eventuali sensazioni fastidiose che occasionalmente potrei sentire. Inoltre mi sono state spiegate altre opzioni di depilazione esistenti che sono disponibili sul mercato con pro e contro delle stesse. In considerazione di quanto esposto scelgo il procedimento di epilazione LASER spiegatomi come trattamento non invasivo per l'epilazione.

MI IMPEGNO
A seguire fedelmente, o al meglio delle mie possibilità, le istruzioni del personale prima, durante e dopo il trattamento di epilazione LASER menzionato. Inoltre mi impegno ad indossare gli occhiali protettivi durante tutto il trattamento, applicare il prodotto fotoprotettivo come raccomandato dal centro, e specialmente ad evitare l'esposizione delle zone trattate al sole o a raggi UVA per un periodo di 2/4 settimane prima e dopo il trattamento, al fine di non favorire l'insorgere degli "effetti secondari" precedentemente descritti.

IN FEDE dichiaro di non avere omesso o alterato i dati relativi alla mia storia clinica personale, e specialmente ciò che concerne le allergie, le malattie od i rischi personali.

AUTORIZZO - Il personale del Centro ad effettuare delle fotografie della zona trattata per uso interno e che non costituiscono nessuna violazione alla mia privacy.

RICONOSCO - Che i risultati ottenibili con questo trattamento non sono miracolosi, e che la sperimentazione effettuata in campo applicativo di questa tecnica, consegue un risultato del 90% dell'esito, e che esiste una casistica del 10% dei soggetti trattati che, per motivi non ben conosciuti, non consegue una riduzione superiore all'80%.

COMPRENDO - che il risultato potrebbe non essere quello da me sperato e riconosco che non mi sono state date garanzie in merito.

AUTORIZZO - che i miei dati vengano trattati in modo automatizzato.

Mi hanno informato inoltre della mia possibilità di recesso da questo consenso. Mi sono stati chiariti tutti i dubbi circa quanto sopradescritto, e sono totalmente d'accordo con questa scrittura di CONSENSO, sottoscrivendone tutti i suoi punti ed autorizzando con la mia firma che il trattamento LASER si realizzi.`;

  const existingConsent = await prisma.consentTemplate.findFirst({
    where: { tenantId: tenant.id, title: "Consenso informato — Epilazione Laser 808nm" },
  });
  if (!existingConsent) {
    await prisma.consentTemplate.create({
      data: {
        tenantId: tenant.id,
        type: "TREATMENT",
        title: "Consenso informato — Epilazione Laser 808nm",
        body: laser808Body,
        version: 1,
        isActive: true,
      },
    });
  }

  // ── Demo appointments with payments ──────────────────────────────────────
  // Find or create demo clients for appointments
  const demoClients = [
    { firstName: "Sofia", lastName: "Ferretti", phone: "333 234 5678", email: "sofia.ferretti@email.it" },
    { firstName: "Giulia", lastName: "Moretti", phone: "347 891 2345", email: null },
    { firstName: "Laura", lastName: "Bianchi", phone: "328 456 7890", email: "laura.bianchi@gmail.com" },
    { firstName: "Anna", lastName: "Russo", phone: "335 123 4567", email: null },
    { firstName: "Emma", lastName: "Colombo", phone: "392 678 9012", email: "emma.colombo@email.it" },
  ];

  const upsertedClients: Awaited<ReturnType<typeof prisma.client.findFirst>>[] = [];
  for (const c of demoClients) {
    let client = await prisma.client.findFirst({ where: { tenantId: tenant.id, phone: c.phone } });
    if (!client) {
      client = await prisma.client.create({
        data: { tenantId: tenant.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email },
      });
    }
    upsertedClients.push(client);
  }

  const [sofia, giulia, laura, anna, emma] = upsertedClients;

  // Find service IDs
  const svcPulizia = await prisma.service.findFirst({ where: { tenantId: tenant.id, name: "Igiene cosmetica" } });
  const svcLaminazione = await prisma.service.findFirst({ where: { tenantId: tenant.id, name: "Laminazione ciglia o sopracciglia" } });
  const svcLaser = await prisma.service.findFirst({ where: { tenantId: tenant.id, name: "Laser 808 — Inguine + Ascelle" } });
  const svcManicure = await prisma.service.findFirst({ where: { tenantId: tenant.id, name: "Manicure semipermanente" } });
  const svcMassaggio = await prisma.service.findFirst({ where: { tenantId: tenant.id, name: "Massaggio" } });

  // Today's date for relative timestamps
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function daysAgo(n: number, h: number, m = 0): Date {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function daysFromNow(n: number, h: number, m = 0): Date {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    d.setHours(h, m, 0, 0);
    return d;
  }

  type ApptSeed = {
    client: typeof sofia;
    service: typeof svcPulizia;
    start: Date;
    status: "COMPLETED" | "BOOKED" | "CANCELLED";
    paymentMethod?: "CASH" | "CARD";
    paymentAmount?: number;
    notes?: string;
  };

  const apptSeeds: ApptSeed[] = [
    // Past completed with cash
    {
      client: sofia, service: svcPulizia,
      start: daysAgo(3, 10, 0),
      status: "COMPLETED",
      paymentMethod: "CASH", paymentAmount: 55,
    },
    // Past completed with POS (CARD)
    {
      client: giulia, service: svcLaminazione,
      start: daysAgo(2, 14, 0),
      status: "COMPLETED",
      paymentMethod: "CARD", paymentAmount: 60,
    },
    // Past completed with cash
    {
      client: laura, service: svcLaser,
      start: daysAgo(1, 11, 0),
      status: "COMPLETED",
      paymentMethod: "CASH", paymentAmount: 45,
      notes: "3ª seduta — buoni risultati",
    },
    // Today
    {
      client: anna, service: svcManicure,
      start: new Date(today.getTime() + 9 * 3600_000),
      status: "BOOKED",
    },
    {
      client: emma, service: svcMassaggio,
      start: new Date(today.getTime() + 14.5 * 3600_000),
      status: "BOOKED",
    },
    // Future
    {
      client: sofia, service: svcLaser,
      start: daysFromNow(2, 10, 30),
      status: "BOOKED",
      notes: "Portare consenso firmato",
    },
    {
      client: giulia, service: svcPulizia,
      start: daysFromNow(4, 16, 0),
      status: "BOOKED",
    },
  ];

  for (const seed of apptSeeds) {
    if (!seed.client || !seed.service) continue;
    const endTime = new Date(seed.start.getTime() + seed.service.durationMinutes * 60_000);

    const existing = await prisma.appointment.findFirst({
      where: { tenantId: tenant.id, clientId: seed.client.id, startTime: seed.start },
    });
    if (existing) continue;

    const appt = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        clientId: seed.client.id,
        serviceId: seed.service.id,
        startTime: seed.start,
        endTime,
        status: seed.status,
        source: "INTERNAL",
        notes: seed.notes ?? null,
      },
    });

    if (seed.paymentMethod && seed.paymentAmount) {
      const existingPayment = await prisma.payment.findUnique({ where: { appointmentId: appt.id } });
      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            tenantId: tenant.id,
            clientId: seed.client.id,
            appointmentId: appt.id,
            amount: seed.paymentAmount,
            method: seed.paymentMethod,
            paidAt: endTime,
          },
        });
      }
    }
  }

  console.log(`✅ La Boutique del Benessere (slug: boutique-del-benessere) — ${services.length} servizi`);
  console.log("   roberta@boutique.it  →  ADMIN");
  console.log("   giulia@boutique.it   →  OPERATOR");
  console.log(`   ${apptSeeds.length} appuntamenti demo (con pagamenti contanti/POS)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
