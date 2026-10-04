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

  console.log(`✅ La Boutique del Benessere (slug: boutique-del-benessere) — ${services.length} servizi`);
  console.log("   roberta@boutique.it  →  ADMIN");
  console.log("   giulia@boutique.it   →  OPERATOR");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
