import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function findOrCreateService(
  tenantId: string,
  data: { name: string; description: string; price: number; durationMinutes: number }
) {
  const existing = await prisma.service.findFirst({
    where: { tenantId, name: data.name },
  });
  if (existing) return existing;

  return prisma.service.create({
    data: { tenantId, ...data },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@fusion-beauty.dev" },
    update: {},
    create: {
      email: "superadmin@fusion-beauty.dev",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      tenantId: null,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "centro-demo" },
    update: {},
    create: {
      name: "Centro Estetico Demo",
      slug: "centro-demo",
      phone: "+39 011 1234567",
      email: "info@centro-demo.it",
      isActive: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@centro-demo.it" },
    update: {},
    create: {
      email: "admin@centro-demo.it",
      passwordHash,
      firstName: "Anna",
      lastName: "Rossi",
      role: "ADMIN",
      tenantId: tenant.id,
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: "operatore@centro-demo.it" },
    update: {},
    create: {
      email: "operatore@centro-demo.it",
      passwordHash,
      firstName: "Giulia",
      lastName: "Bianchi",
      role: "OPERATOR",
      tenantId: tenant.id,
    },
  });

  const services = await Promise.all(
    [
      {
        name: "Manicure",
        description: "Trattamento manicure classico",
        price: 25.0,
        durationMinutes: 30,
      },
      {
        name: "Pedicure",
        description: "Trattamento pedicure completo",
        price: 35.0,
        durationMinutes: 45,
      },
      {
        name: "Massaggio rilassante",
        description: "Massaggio corpo completo di 60 minuti",
        price: 60.0,
        durationMinutes: 60,
      },
    ].map((service) => findOrCreateService(tenant.id, service))
  );

  const existingClient = await prisma.client.findFirst({
    where: { tenantId: tenant.id, phone: "+39 333 1112233" },
  });

  const client =
    existingClient ??
    (await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: "Maria",
        lastName: "Verdi",
        phone: "+39 333 1112233",
        email: "maria.verdi@example.com",
        notes: "Cliente abituale, preferisce il sabato mattina.",
      },
    }));

  console.log({
    superAdmin: superAdmin.email,
    tenant: tenant.slug,
    admin: admin.email,
    operator: operator.email,
    services: services.map((s) => s.name),
    client: `${client.firstName} ${client.lastName}`,
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
