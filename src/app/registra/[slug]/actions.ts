"use server";

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

  const existing = await prisma.client.findFirst({
    where: { tenantId: tenant.id, phone },
  });

  if (existing) {
    await prisma.client.update({
      where: { id: existing.id },
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email?.trim() || existing.email,
        notes: data.notes?.trim() || existing.notes,
      },
    });
  } else {
    await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone,
        email: data.email?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });
  }

  return { success: true };
}
