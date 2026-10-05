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

  console.log(`✅ La Boutique del Benessere (slug: boutique-del-benessere) — ${services.length} servizi`);
  console.log("   roberta@boutique.it  →  ADMIN");
  console.log("   giulia@boutique.it   →  OPERATOR");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
