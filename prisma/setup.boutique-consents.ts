// Consenso informato per l'epilazione laser 808nm de La Boutique del Benessere (dal modulo cartaceo del centro).
// Gira a ogni deploy: crea il modello solo se manca, collegato a tutti i trattamenti "Laser 808 …".
// Se esiste già non tocca mai il testo (il centro può averlo modificato): collega solo i
// trattamenti laser aggiunti al listino dopo la creazione del modello (o tutti, se il modello
// non è ancora collegato a nessun trattamento). Non fallisce mai per dati mancanti.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TITLE = "Consenso informato – Epilazione laser 808nm";
const CENTER = "La Boutique del Benessere";

// Nome, telefono e data li mette l'app (scheda cliente e giorno della firma).
const BODY = `CONSENSO INFORMATO SULLA EPILAZIONE LASER 808nm

DICHIARO
Che attraverso questo documento RICHIEDO ED AUTORIZZO il personale del Centro Estetico ${CENTER} ad effettuare sulla mia persona il trattamento di epilazione con LASER, che si dettaglia come segue.

BREVE SPIEGAZIONE DEL TRATTAMENTO
Il Centro Estetico ${CENTER} utilizza un apparato laser impulsato, progettato e costruito per l'impiego nel settore estetico e opportunamente defocalizzato esclusivamente per i trattamenti di depilazione. L'interazione laser-bulbo pilifero è essenzialmente termica. Il processo, noto come "fototermolisi selettiva", richiede un certo numero di sedute (tipicamente all'incirca 10).

CONTROINDICAZIONI
Possono includere: pace-maker, patologie cardiache, patologie della pelle, epilessia, asma, trattamenti medici fotosensibilizzanti, gravidanza o allattamento, diabete, processi maligni, recente esposizione solare, uso di farmaci fotosensibilizzanti. Inoltre sono stato/a informato/a che devo comunicare al personale del Centro il consumo di qualunque sostanza farmacologica ed il cambiamento del mio stato basale (gravidanza, malattie, allergie…). È sconsigliato, ugualmente, sulla pelle molto abbronzata o che si stia per sottoporre ai raggi UVA, presenza di tatuaggi, nevi in rilievo, aumentando in questo caso il rischio di bruciature. Nel caso di trattamento al seno: allattamento, mastopatia fibrocistica, noduli, protesi.
Normalmente il trattamento non è doloroso e non presenta complicazioni, però comprendo la possibilità di "effetti secondari" che si producono raramente, come la comparsa di zone di ipo ed iper pigmentazione temporanea, bruciature superficiali temporanee, arrossamenti, cicatrici ed eruzioni acneiformi, come conseguenza di un effetto termico passeggero.

RISCHI INERENTI IL CLIENTE E LE SUE CIRCOSTANZE PERSONALI
Sono stato/a informato/a che dopo il trattamento è normale che la zona presenti un eritema od un edema, di solito leggero, o una piccola vescicola intradermica. Nella norma questi effetti durano solo poche ore anche se in alcuni casi possono essere più persistenti. Soprattutto il rischio è maggiore per le pelli scure o che sono state esposte al sole recentemente, in quanto la presenza di melanina è maggiore. Inoltre può presentarsi un cambio di pigmentazione (ipo o iper) che in generale è transitorio, e che trattato adeguatamente sparisce in poco tempo.

CONFERMO
Che il trattamento menzionato mi è stato spiegato a fondo da un professionista (operatore estetico) con parole comprensibili per me, i rischi che presenta, gli effetti indesiderati, i rischi caratteristici della mia persona, così come i disturbi o eventuali sensazioni fastidiose che occasionalmente potrei sentire. Inoltre mi sono state spiegate altre opzioni di depilazione esistenti che sono disponibili sul mercato con pro e contro delle stesse. In considerazione di quanto esposto scelgo il procedimento di epilazione LASER spiegatomi come trattamento non invasivo per l'epilazione.

MI IMPEGNO
A seguire fedelmente, o al meglio delle mie possibilità, le istruzioni del personale prima, durante e dopo il trattamento di epilazione LASER menzionato. Inoltre mi impegno ad indossare gli occhiali protettivi durante tutto il trattamento, applicare il prodotto fotoprotettivo come raccomandato dal centro, e specialmente ad evitare l'esposizione delle zone trattate al sole o a raggi UVA per un periodo di 2/4 settimane prima e dopo il trattamento, al fine di non favorire l'insorgere degli "effetti secondari" precedentemente descritti.

IN FEDE dichiaro di non avere omesso o alterato i dati relativi alla mia storia clinica personale, e specialmente ciò che concerne le allergie, le malattie od i rischi personali.

AUTORIZZO il personale del Centro ad effettuare delle fotografie della zona trattata per uso interno e che non costituiscono nessuna violazione alla mia privacy.

RICONOSCO che i risultati ottenibili con questo trattamento non sono miracolosi, e che la sperimentazione effettuata in campo applicativo di questa tecnica consegue un risultato del 90% dell'esito, e che esiste una casistica del 10% dei soggetti trattati che, per motivi non ben conosciuti, non consegue una riduzione superiore all'80%.

COMPRENDO che il risultato potrebbe non essere quello da me sperato e riconosco che non mi sono state date garanzie in merito.

AUTORIZZO che i miei dati vengano trattati in modo automatizzato.

Mi hanno informato inoltre della mia possibilità di recesso da questo consenso.
Mi sono stati chiariti tutti i dubbi circa quanto sopradescritto, e sono totalmente d'accordo con questa scrittura di CONSENSO, sottoscrivendone tutti i suoi punti ed autorizzando con la mia firma che il trattamento LASER si realizzi.`;

// Le controindicazioni del modulo, da spuntare prima della firma (anamnesi).
const CHECKLIST = [
  "Pace-maker",
  "Patologie cardiache",
  "Patologie della pelle",
  "Epilessia",
  "Asma",
  "Diabete",
  "Processi maligni (tumori)",
  "Gravidanza o allattamento",
  "Farmaci o trattamenti medici fotosensibilizzanti",
  "Recente esposizione al sole o lampade UVA (pelle molto abbronzata)",
  "Tatuaggi o nei in rilievo nella zona da trattare",
  "Solo per il seno: mastopatia fibrocistica, noduli o protesi",
];

const isLaser = (name: string) => /^laser 808/i.test(name.trim());

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "boutique-del-benessere" }, select: { id: true } });
  if (!tenant) {
    console.log("↷ La Boutique del Benessere non trovata, saltato");
    return;
  }

  const services = (
    await prisma.service.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true, createdAt: true } })
  ).filter((service) => isLaser(service.name));

  const existing = await prisma.consentTemplate.findFirst({
    where: { tenantId: tenant.id, type: "TREATMENT", title: { contains: "laser 808", mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, serviceId: true, checklist: true, services: { select: { id: true } } },
  });

  if (!existing) {
    await prisma.consentTemplate.create({
      data: {
        tenantId: tenant.id,
        type: "TREATMENT",
        title: TITLE,
        body: BODY,
        checklist: CHECKLIST,
        isActive: true,
        services: { connect: services.map((service) => ({ id: service.id })) },
      },
    });
    console.log(`✅ Consenso laser creato, collegato a ${services.length} trattamenti Laser 808`);
    return;
  }

  const linked = new Set([existing.serviceId, ...existing.services.map((service) => service.id)].filter(Boolean));

  // Modello già presente ma mai collegato (es. creato prima che un consenso valesse per più
  // trattamenti): si collega a tutto il laser e riceve le domande di salute, se non ne ha.
  // Il testo non si tocca.
  if (linked.size === 0) {
    await prisma.consentTemplate.update({
      where: { id: existing.id },
      data: {
        services: { connect: services.map((service) => ({ id: service.id })) },
        ...(existing.checklist.length === 0 ? { checklist: CHECKLIST } : {}),
      },
    });
    console.log(`✅ Consenso laser esistente collegato a ${services.length} trattamenti Laser 808`);
    return;
  }

  // Solo i trattamenti nati dopo il modello: quelli già esistenti tolti dal centro restano tolti.
  const added = services.filter((service) => !linked.has(service.id) && service.createdAt > existing.createdAt);
  if (added.length === 0) {
    console.log("↷ Consenso laser già presente, invariato");
    return;
  }

  await prisma.consentTemplate.update({
    where: { id: existing.id },
    data: { services: { connect: added.map((service) => ({ id: service.id })) } },
  });
  console.log(`✅ Consenso laser: collegati ${added.length} nuovi trattamenti (${added.map((service) => service.name).join(", ")})`);
}

main()
  .catch((error) => {
    // Mai bloccare il deploy: il consenso si può sempre creare a mano da "Modelli consenso".
    console.error("⚠ setup consenso laser non completato:", error);
  })
  .finally(() => prisma.$disconnect());
