/**
 * Esporta gli utenti di Beauty per l'import in Fusion ID (hash bcrypt inclusi:
 * nessuno deve reimpostare la password). File privato: cancellarlo dopo l'import.
 *
 *   npx tsx scripts/fusion-id-export-users.ts > export-beauty.json
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const users = await prisma.user.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  process.stdout.write(
    JSON.stringify(
      {
        product: "beauty",
        exportedAt: new Date().toISOString(),
        users: users.map((u) => ({
          email: u.email,
          name: `${u.firstName} ${u.lastName}`.trim(),
          passwordHash: u.passwordHash,
          staff: u.role === "SUPER_ADMIN",
          emailVerified: true,
        })),
      },
      null,
      2,
    ) + "\n",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
