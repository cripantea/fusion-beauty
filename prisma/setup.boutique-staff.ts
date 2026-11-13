// Orari e trattamenti delle operatrici de La Boutique del Benessere (comunicati da Giulia il 05/10/2026).
// Solo per chi non è ancora configurata: tocca solo working_hours ed esclusioni trattamenti.
// Dalila è in standby: niente orari fissi (online non è prenotabile); i giorni in cui c'è
// si aprono da Staff e orari → Imprevisti, o le si assegnano appuntamenti dall'agenda.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// dayOfWeek: 1 = lunedì … 7 = domenica. Mercoledì e domenica chiuso.
type Hours = [dayOfWeek: number, startTime: string, endTime: string][];

type Member = { email: string; hours: Hours } & (
  | { excludedServices: string[] }
  // Solo questi trattamenti: tutto il resto del listino è escluso.
  | { onlyServices: (name: string) => boolean }
);

const staff: Member[] = [
  {
    // Fa tutto tranne manicure e sopracciglia/ciglia.
    email: "roberta@boutique.it",
    hours: [
      [1, "09:30", "15:30"],
      [2, "09:30", "19:00"],
      [4, "10:30", "21:00"],
      [5, "09:30", "15:30"],
      [6, "09:30", "17:00"],
    ],
    excludedServices: [
      "Manicure",
      "Manicure semipermanente",
      "Ricostruzione soft gel tip",
      "Riparazione unghia",
      "Laminazione ciglia o sopracciglia",
    ],
  },
  {
    // Fa tutto tranne pedicure curativo (non ancora a listino).
    email: "giulia@boutique.it",
    hours: [
      [1, "09:30", "17:00"],
      [2, "09:30", "19:00"],
      [4, "10:30", "21:00"],
      [5, "11:30", "19:30"],
      [6, "09:30", "17:00"],
    ],
    excludedServices: [],
  },
  {
    // Solo manicure, ceretta e pedicure (no curativo, no sopracciglia, no laser).
    email: "dalila@boutique.it",
    hours: [],
    onlyServices: (name) =>
      /^(manicure|pedicure|pedispa|ricostruzione|riparazione unghia|epilazione)/i.test(name),
  },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "boutique-del-benessere" } });
  if (!tenant) return;

  for (const member of staff) {
    const user = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: member.email },
      select: { id: true, _count: { select: { workingHours: true, excludedServices: true } } },
    });
    if (!user) {
      console.log(`↷ ${member.email}: non trovata, saltata`);
      continue;
    }
    // Gira a ogni deploy: se il centro ha già impostato orari o trattamenti, non si tocca nulla.
    if (user._count.workingHours > 0 || user._count.excludedServices > 0) {
      console.log(`↷ ${member.email}: già configurata, invariata`);
      continue;
    }

    let services: { id: string; name: string }[];
    if ("onlyServices" in member) {
      const all = await prisma.service.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true } });
      services = all.filter((service) => !member.onlyServices(service.name));
    } else {
      services = await prisma.service.findMany({
        where: { tenantId: tenant.id, name: { in: member.excludedServices } },
        select: { id: true, name: true },
      });
      const missing = member.excludedServices.filter((name) => !services.some((service) => service.name === name));
      if (missing.length > 0) console.warn(`⚠ ${member.email}: trattamenti non trovati: ${missing.join(", ")}`);
    }

    await prisma.$transaction([
      prisma.workingHours.deleteMany({ where: { tenantId: tenant.id, userId: user.id } }),
      prisma.workingHours.createMany({
        data: member.hours.map(([dayOfWeek, startTime, endTime]) => ({
          tenantId: tenant.id,
          userId: user.id,
          dayOfWeek,
          startTime,
          endTime,
          isActive: true,
        })),
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { excludedServices: { set: services.map((service) => ({ id: service.id })) } },
      }),
    ]);

    console.log(`✅ ${member.email}: ${member.hours.length} giorni, ${services.length} trattamenti esclusi`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
