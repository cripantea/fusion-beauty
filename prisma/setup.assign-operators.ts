// Ogni appuntamento va nell'agenda di un'operatrice: i prossimi appuntamenti
// rimasti senza operatrice (vecchie prenotazioni online) vanno a un'operatrice
// che esegue il trattamento e in quell'orario è libera, la meno impegnata del
// giorno. Gira a ogni deploy; se non ce ne sono non fa nulla.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const pending = await prisma.appointment.findMany({
    where: { operatorId: null, status: { in: ["BOOKED", "CONFIRMED"] }, endTime: { gt: new Date() } },
    orderBy: { startTime: "asc" },
    select: { id: true, tenantId: true, serviceId: true, startTime: true, endTime: true },
  });

  for (const appointment of pending) {
    const candidates = await prisma.user.findMany({
      where: {
        tenantId: appointment.tenantId,
        isActive: true,
        role: { in: ["ADMIN", "OPERATOR"] },
        excludedServices: { none: { id: appointment.serviceId } },
      },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true },
    });
    if (candidates.length === 0) continue;

    const dayStart = new Date(appointment.startTime.getTime() - 12 * 3_600_000);
    const dayEnd = new Date(appointment.startTime.getTime() + 12 * 3_600_000);
    const overlap = { startTime: { lt: appointment.endTime }, endTime: { gt: appointment.startTime } };
    const scored = await Promise.all(
      candidates.map(async (op) => {
        const [clash, block, booked] = await Promise.all([
          prisma.appointment.count({ where: { operatorId: op.id, status: { in: ["BOOKED", "CONFIRMED"] }, ...overlap } }),
          prisma.staffBlock.count({ where: { userId: op.id, ...overlap } }),
          prisma.appointment.count({
            where: { operatorId: op.id, status: { in: ["BOOKED", "CONFIRMED"] }, startTime: { gte: dayStart, lt: dayEnd } },
          }),
        ]);
        return { op, free: clash + block === 0, booked };
      })
    );
    const best = scored.filter((s) => s.free).sort((a, b) => a.booked - b.booked)[0] ?? scored[0];
    await prisma.appointment.update({ where: { id: appointment.id }, data: { operatorId: best.op.id } });
    console.log(`✅ Appuntamento ${appointment.id} → ${best.op.firstName}${best.free ? "" : " (accavallato: da controllare)"}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
