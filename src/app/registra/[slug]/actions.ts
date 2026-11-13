"use server";

import { after } from "next/server";

import { triggerClientCreated } from "@/lib/automation-engine";
import { findClientIdByPhone } from "@/lib/client-phone";
import { prisma } from "@/lib/prisma";

export type RegisterClientResult =
  | { success: true }
  | { success: false; error: string };

export async function registerClient(
  slug: string,
  data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    notes?: string;
  }
): Promise<RegisterClientResult> {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || !tenant.isActive) {
    return { success: false, error: "Centro non trovato." };
  }

  const phone = data.phone.trim();
  if (!phone) return { success: false, error: "Il numero di telefono è obbligatorio." };

  // Stessa cliente anche se il numero è scritto diverso: nome e cognome in scheda restano.
  const existingId = await findClientIdByPhone(tenant.id, phone);
  const existing = existingId ? await prisma.client.findUnique({ where: { id: existingId } }) : null;

  if (existing) {
    await prisma.client.update({
      where: { id: existing.id },
      data: {
        email: existing.email || data.email?.trim() || null,
        notes: data.notes?.trim() ? [existing.notes, data.notes.trim()].filter(Boolean).join("\n") : existing.notes,
      },
    });
  } else {
    const client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone,
        email: data.email?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });
    after(() => triggerClientCreated(tenant.id, client.id));
  }

  return { success: true };
}
