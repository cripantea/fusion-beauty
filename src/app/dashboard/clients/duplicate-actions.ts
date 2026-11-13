"use server";

import { revalidatePath } from "next/cache";

import { getTenantContext } from "@/lib/auth-context";
import { normalizePhoneForWhatsapp } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export type DuplicateGroupDTO = {
  phone: string;
  /** La prima registrata: è quella che resta, con il suo nome. */
  keep: { id: string; name: string; createdAt: string };
  others: { id: string; name: string; createdAt: string }[];
};

const fullName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.trim();

/** Clienti con lo stesso numero (anche scritto diverso: +39, spazi, 0039…). */
export async function getDuplicateGroups(): Promise<DuplicateGroupDTO[]> {
  const { tenantId } = await getTenantContext();
  const clients = await prisma.client.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true },
  });

  const byPhone = new Map<string, typeof clients>();
  for (const client of clients) {
    const digits = client.phone.replace(/\D/g, "");
    if (digits.length < 8) continue; // "N/D" e numeri vuoti non sono doppioni
    const key = normalizePhoneForWhatsapp(client.phone);
    byPhone.set(key, [...(byPhone.get(key) ?? []), client]);
  }

  return [...byPhone.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([phone, [keep, ...others]]) => ({
      phone,
      keep: { id: keep.id, name: fullName(keep), createdAt: keep.createdAt.toISOString() },
      others: others.map((c) => ({ id: c.id, name: fullName(c), createdAt: c.createdAt.toISOString() })),
    }));
}

/**
 * Unisce i doppioni nella prima scheda: appuntamenti, pagamenti, consensi,
 * messaggi, percorsi e il resto passano a lei; le altre schede si eliminano.
 * Dalle altre si recuperano solo i dati che mancano (email, città, note…).
 */
export async function mergeDuplicateGroup(phone: string): Promise<{ success: true; merged: number } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();
  const group = (await getDuplicateGroups()).find((g) => g.phone === phone);
  if (!group) return { success: false, error: "Doppione non trovato: ricarica la pagina." };

  const keepId = group.keep.id;
  const dropIds = group.others.map((o) => o.id);
  const [keep, drops] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: keepId } }),
    prisma.client.findMany({ where: { id: { in: dropIds }, tenantId }, orderBy: { createdAt: "asc" } }),
  ]);

  const move = { where: { clientId: { in: dropIds } }, data: { clientId: keepId } };
  await prisma.$transaction(async (tx) => {
    // Stessa campagna su due schede: resta un solo destinatario.
    const kept = await tx.campaignRecipient.findMany({ where: { clientId: keepId }, select: { campaignId: true } });
    await tx.campaignRecipient.deleteMany({ where: { clientId: { in: dropIds }, campaignId: { in: kept.map((k) => k.campaignId) } } });

    await tx.appointment.updateMany(move);
    await tx.payment.updateMany(move);
    await tx.consentRecord.updateMany(move);
    await tx.clientQuestionnaire.updateMany(move);
    await tx.clientPlan.updateMany(move);
    await tx.formSubmission.updateMany(move);
    await tx.whatsappMessage.updateMany(move);
    await tx.automationRun.updateMany(move);
    await tx.campaignRecipient.updateMany(move);
    await tx.paymentLink.updateMany(move);

    const pick = <K extends keyof typeof keep>(key: K) => keep[key] ?? drops.find((d) => d[key] != null)?.[key] ?? null;
    const notes = [keep.notes, ...drops.map((d) => d.notes)].filter(Boolean).join("\n") || null;
    await tx.client.update({
      where: { id: keepId },
      data: {
        email: pick("email"),
        city: pick("city"),
        taxCode: pick("taxCode"),
        dateOfBirth: pick("dateOfBirth"),
        allergies: pick("allergies"),
        healthNotes: pick("healthNotes"),
        acquisitionSource: pick("acquisitionSource"),
        notes,
        interests: Array.from(new Set([keep.interests, ...drops.map((d) => d.interests)].flat())),
      },
    });
    await tx.client.deleteMany({ where: { id: { in: dropIds }, tenantId } });
  });

  revalidatePath("/dashboard/clients");
  return { success: true, merged: dropIds.length };
}
