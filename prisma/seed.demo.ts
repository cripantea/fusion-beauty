// Dati dimostrativi relativi a oggi (agenda, incassi, clienti inattive, compleanni, richiesta online).
// Prerequisito: `pnpm db:seed`. Idempotente: se esiste già la cliente "Giulia Rossi" non fa nulla.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function at(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "centro-demo" } });
  if (!tenant) throw new Error("Esegui prima `pnpm db:seed`.");

  const already = await prisma.client.findFirst({
    where: { tenantId: tenant.id, firstName: "Giulia", lastName: "Rossi" },
  });
  if (already) {
    console.log("Dati demo già presenti.");
    return;
  }

  const tenantId = tenant.id;
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const roberta = await prisma.user.upsert({
    where: { email: "roberta@centro-demo.it" },
    update: {},
    create: { email: "roberta@centro-demo.it", passwordHash, firstName: "Roberta", lastName: "Conti", role: "OPERATOR", tenantId },
  });
  const martina = await prisma.user.upsert({
    where: { email: "martina@centro-demo.it" },
    update: {},
    create: { email: "martina@centro-demo.it", passwordHash, firstName: "Martina", lastName: "Verdi", role: "OPERATOR", tenantId },
  });
  const giulia = await prisma.user.findUniqueOrThrow({ where: { email: "operatore@centro-demo.it" } });

  async function service(name: string, price: number, durationMinutes: number) {
    return (
      (await prisma.service.findFirst({ where: { tenantId, name } })) ??
      prisma.service.create({ data: { tenantId, name, price, durationMinutes } })
    );
  }
  const viso = await service("Pulizia Viso Avanzata", 65, 60);
  const neuro = await service("Trattamento Neuro-K", 90, 60);
  const laser = await service("Laser 808 Gambe", 120, 90);
  const manicure = await service("Manicure + Semipermanente", 35, 45);

  const birthdaySoon = new Date();
  birthdaySoon.setDate(birthdaySoon.getDate() + 3);

  const people = {
    giulia: await prisma.client.create({
      data: {
        tenantId, firstName: "Giulia", lastName: "Rossi", phone: "+39 338 9121234", city: "Vigevano",
        dateOfBirth: new Date(Date.UTC(1990, birthdaySoon.getMonth(), birthdaySoon.getDate())),
        notes: "Pelle delicata area zigomatica. Gradisce tisana rilassante a fine seduta.",
        interests: ["Pulizia Viso Avanzata", "Laser 808 Gambe"], acquisitionSource: "Instagram",
      },
    }),
    elena: await prisma.client.create({ data: { tenantId, firstName: "Elena", lastName: "Bianchi", phone: "+39 347 5550102", city: "Mortara" } }),
    maria: await prisma.client.create({ data: { tenantId, firstName: "Maria", lastName: "Conti", phone: "+39 349 5550103" } }),
    anna: await prisma.client.create({ data: { tenantId, firstName: "Anna", lastName: "Verdi", phone: "+39 340 5550104" } }),
    sara: await prisma.client.create({ data: { tenantId, firstName: "Sara", lastName: "Bianchi", phone: "+39 331 5550105" } }),
    laura: await prisma.client.create({ data: { tenantId, firstName: "Laura", lastName: "Verdi", phone: "+39 333 5550106" } }),
    chiara: await prisma.client.create({ data: { tenantId, firstName: "Chiara", lastName: "Ferrari", phone: "+39 338 5550107" } }),
  };

  async function visit(clientId: string, serviceId: string, price: number, start: Date, operatorId: string, method: "CARD" | "CASH") {
    const svc = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    const appointment = await prisma.appointment.create({
      data: {
        tenantId, clientId, serviceId, operatorId, startTime: start,
        endTime: new Date(start.getTime() + svc.durationMinutes * 60000), status: "COMPLETED",
      },
    });
    await prisma.payment.create({
      data: { tenantId, clientId, appointmentId: appointment.id, amount: price, method, paidAt: start },
    });
  }

  // Storico: Giulia è una cliente fedele (una visita ogni ~12 giorni nell'ultimo anno).
  for (let i = 0; i < 18; i++) {
    const svc = [viso, neuro, laser][i % 3];
    await visit(people.giulia.id, svc.id, svc.price.toNumber(), at(-21 - i * 12, 10 + (i % 5)), roberta.id, i % 2 ? "CASH" : "CARD");
  }
  // Clienti che non tornano da oltre 6 mesi.
  await visit(people.sara.id, viso.id, 65, at(-240, 11), roberta.id, "CARD");
  await visit(people.sara.id, manicure.id, 35, at(-300, 15), martina.id, "CASH");
  await visit(people.laura.id, laser.id, 120, at(-200, 16), giulia.id, "CARD");
  // Qualche visita recente di altre clienti.
  await visit(people.chiara.id, manicure.id, 35, at(-6, 17), martina.id, "CARD");
  await visit(people.maria.id, neuro.id, 90, at(-9, 9), roberta.id, "CASH");

  // Oggi.
  await visit(people.maria.id, viso.id, 65, at(0, 9, 30), roberta.id, "CARD");
  const book = (clientId: string, serviceId: string, operatorId: string, start: Date, status: "BOOKED" | "CONFIRMED", source: "INTERNAL" | "ONLINE" = "INTERNAL") =>
    prisma.service.findUniqueOrThrow({ where: { id: serviceId } }).then((svc) =>
      prisma.appointment.create({
        data: { tenantId, clientId, serviceId, operatorId, startTime: start, endTime: new Date(start.getTime() + svc.durationMinutes * 60000), status, source },
      })
    );
  const now = new Date();
  const hour = now.getHours();
  await book(people.giulia.id, viso.id, roberta.id, at(0, Math.min(hour + 1, 19)), "CONFIRMED");
  await book(people.elena.id, laser.id, giulia.id, at(0, Math.min(hour + 2, 19), 15), "CONFIRMED");
  await book(people.anna.id, manicure.id, martina.id, at(0, Math.min(hour + 3, 19)), "BOOKED");
  // Domani + richiesta dal sito.
  await book(people.chiara.id, manicure.id, martina.id, at(1, 17), "CONFIRMED");
  await book(people.elena.id, neuro.id, roberta.id, at(1, 10, 30), "BOOKED");
  await book(people.sara.id, viso.id, roberta.id, at(2, 15), "BOOKED", "ONLINE");

  console.log("Dati demo creati.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
