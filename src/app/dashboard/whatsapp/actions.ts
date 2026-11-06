"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { WhatsappAutomationKind } from "@/generated/prisma/client";
import { requireTenantAdmin } from "@/lib/auth-context";
import { createTemplate, deleteTemplate, getConnectionState, listTemplates, resetConnection, type FusionWaTemplate } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";
import { AUTOMATION_KINDS } from "@/lib/whatsapp";

type Result = { success: true } | { success: false; error: string };

/**
 * Salva il numero collegato con l'Embedded Signup, ma solo dopo averlo
 * riverificato server-to-server su Fusion WA: i dati arrivano dal browser.
 */
export async function adoptConnection(): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const state = await getConnectionState(tenantId);
  if (!state.ok) return { success: false, error: state.error };
  const connection = state.state.connection;
  if (!connection || connection.status !== "CONNECTED") {
    return { success: false, error: "Il collegamento non risulta completato. Riprova tra qualche secondo." };
  }

  const taken = await prisma.whatsappConnection.findUnique({ where: { phoneNumberId: connection.phoneNumberId } });
  if (taken && taken.tenantId !== tenantId) {
    return { success: false, error: "Questo numero è già collegato a un altro centro." };
  }

  await prisma.whatsappConnection.upsert({
    where: { tenantId },
    create: { tenantId, wabaId: connection.wabaId, phoneNumberId: connection.phoneNumberId, phoneNumber: connection.phoneNumber },
    update: { wabaId: connection.wabaId, phoneNumberId: connection.phoneNumberId, phoneNumber: connection.phoneNumber },
  });
  revalidatePath("/dashboard/whatsapp");
  return { success: true };
}

/** Scollega il numero da Fusion Beauty (resta su Meta e sull'app WhatsApp Business). */
export async function disconnectWhatsapp(): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const connection = await prisma.whatsappConnection.findUnique({ where: { tenantId } });
  if (!connection) return { success: true };
  const reset = await resetConnection(tenantId, connection.phoneNumberId);
  if (!reset.ok) return { success: false, error: reset.error };
  await prisma.whatsappConnection.delete({ where: { tenantId } });
  revalidatePath("/dashboard/whatsapp");
  return { success: true };
}

export async function fetchTemplates(): Promise<{ success: true; templates: FusionWaTemplate[] } | { success: false; error: string }> {
  const { tenantId } = await requireTenantAdmin();
  const result = await listTemplates(tenantId);
  if (!result.ok) return { success: false, error: result.error };
  return { success: true, templates: result.templates };
}

const templateSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,512}$/, "Il nome può contenere solo lettere minuscole, numeri e trattino basso (es. promemoria_appuntamento)."),
  category: z.enum(["UTILITY", "MARKETING"]),
  bodyText: z.string().trim().min(1, "Scrivi il testo del messaggio.").max(1024),
  bodyExamples: z.array(z.string().trim().min(1, "Scrivi un esempio per ogni variabile.")),
  footerText: z.string().trim().max(60).optional(),
});

export async function submitTemplate(values: z.input<typeof templateSchema>): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const parsed = templateSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const variables = new Set(parsed.data.bodyText.match(/\{\{(\d+)\}\}/g) ?? []);
  if (variables.size !== parsed.data.bodyExamples.length) {
    return { success: false, error: "Serve un esempio per ogni variabile {{1}}, {{2}}…" };
  }

  const result = await createTemplate({
    tenantId,
    name: parsed.data.name,
    language: "it",
    category: parsed.data.category,
    bodyText: parsed.data.bodyText,
    bodyExamples: parsed.data.bodyExamples,
    footerText: parsed.data.footerText,
  });
  if (!result.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function removeTemplate(name: string, externalId: string | null): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const inUse = await prisma.whatsappAutomation.findFirst({ where: { tenantId, templateName: name, enabled: true } });
  if (inUse) return { success: false, error: "Il template è usato da un messaggio automatico attivo: disattivalo prima." };
  const result = await deleteTemplate(tenantId, name, externalId);
  if (!result.ok) return { success: false, error: result.error };
  return { success: true };
}

const automationSchema = z.object({
  kind: z.enum(AUTOMATION_KINDS as [WhatsappAutomationKind, ...WhatsappAutomationKind[]]),
  enabled: z.boolean(),
  templateName: z.string().trim().max(512),
  language: z.string().trim().max(20),
  templateBody: z.string().max(2000),
  params: z.array(z.string().max(500)).max(20),
});

export async function saveAutomation(values: z.input<typeof automationSchema>): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const parsed = automationSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: "Dati non validi." };
  const { kind, ...data } = parsed.data;
  if (data.enabled && !data.templateName) return { success: false, error: "Scegli un template approvato." };
  if (data.enabled && data.params.some((p) => !p.trim())) return { success: false, error: "Compila tutte le variabili del template." };

  await prisma.whatsappAutomation.upsert({
    where: { tenantId_kind: { tenantId, kind } },
    create: { tenantId, kind, ...data },
    update: data,
  });
  revalidatePath("/dashboard/whatsapp");
  return { success: true };
}
