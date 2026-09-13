import "dotenv/config";
import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  if (!email) {
    throw new Error("SEED_SUPER_ADMIN_EMAIL is required to seed production.");
  }

  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super admin already exists: ${email} (no changes made).`);
    return;
  }

  const superAdmin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      tenantId: null,
    },
  });

  console.log(`Super admin created: ${superAdmin.email}`);
  if (!process.env.SEED_SUPER_ADMIN_PASSWORD) {
    console.log(`Generated password (save it now, it will not be shown again): ${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
