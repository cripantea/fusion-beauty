// Orari e trattamenti delle operatrici de La Boutique del Benessere (comunicati da Giulia il 05/10/2026).
// Idempotente: tocca solo working_hours ed esclusioni trattamenti, nessun dato demo.
// Dalila è in standby: orari variabili, da configurare più avanti.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// dayOfWeek: 1 = lunedì … 7 = domenica. Mercoledì e domenica chiuso.
type Hours = [dayOfWeek: number, startTime: string, endTime: string][];

const staff: { email: string; hours: Hours; excludedServices: string[] }[] = [
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
];

async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "boutique-del-benessere" } });

  for (const member of staff) {
    const user = await prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: member.email } });

    const services = await prisma.service.findMany({
      where: { tenantId: tenant.id, name: { in: member.excludedServices } },
      select: { id: true, name: true },
    });
    const missing = member.excludedServices.filter((name) => !services.some((service) => service.name === name));
    if (missing.length > 0) throw new Error(`Trattamenti non trovati per ${member.email}: ${missing.join(", ")}`);

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
