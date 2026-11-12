"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { requireTenantAdmin } from "@/lib/auth-context";
import { audienceClients, startCampaign } from "@/lib/campaign-runner";
import { audienceProblem, audienceSchema, campaignInputSchema, type Audience, type CampaignInput } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { hasActiveWhatsapp } from "@/lib/whatsapp";

type Result = { success: true } | { success: false; error: string };

/** Quante clienti riceverebbero la campagna (e qualche nome, per controllo). */
export async function previewAudience(
  values: Audience
): Promise<{ success: true; count: number; sample: string[]; withoutConsent: number | null } | { success: false; error: string }> {
  const { tenantId } = await requireTenantAdmin();
  const parsed = audienceSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: "Pubblico non valido." };
  const problem = audienceProblem(parsed.data);
  if (problem) return { success: false, error: problem };
  const clients = await audienceClients(tenantId, parsed.data);
  // Quante si perdono per il consenso marketing: aiuta a capire perché il numero è basso.
  const withoutConsent = parsed.data.marketingConsentOnly
    ? (await audienceClients(tenantId, { ...parsed.data, marketingConsentOnly: false })).length - clients.length
    : null;
  return {
    success: true,
    count: clients.length,
    sample: clients.slice(0, 5).map((c) => `${c.firstName} ${c.lastName}`.trim()),
    withoutConsent,
  };
}

export async function createCampaign(values: CampaignInput): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const { tenantId } = await requireTenantAdmin();
  const parsed = campaignInputSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Controlla i dati della campagna." };
  const problem = audienceProblem(parsed.data.audience);
  if (problem) return { success: false, error: problem };
  if (parsed.data.audience.serviceIds?.length) {
    const count = await prisma.service.count({ where: { tenantId, id: { in: parsed.data.audience.serviceIds } } });
    if (count !== parsed.data.audience.serviceIds.length) return { success: false, error: "Uno dei trattamenti scelti non esiste più." };
  }
  if (!(await hasActiveWhatsapp(tenantId))) return { success: false, error: "Collega prima WhatsApp." };

  const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) return { success: false, error: "La data di invio è nel passato." };

  const campaign = await prisma.campaign.create({
    data: {
      tenantId,
      name: parsed.data.name,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      templateName: parsed.data.templateName,
      language: parsed.data.language,
      templateBody: parsed.data.templateBody,
      params: parsed.data.params,
      audience: parsed.data.audience as Prisma.InputJsonValue,
      scheduledAt,
      batchSize: parsed.data.batchSize,
      batchIntervalMinutes: parsed.data.batchIntervalMinutes,
    },
  });

  if (!scheduledAt) {
    const started = await startCampaign(campaign.id);
    if (!started.ok) {
      revalidatePath("/dashboard/campaigns");
      return { success: false, error: started.error };
    }
  }
  revalidatePath("/dashboard/campaigns");
  return { success: true, id: campaign.id };
}

export async function pauseCampaign(id: string): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const result = await prisma.campaign.updateMany({ where: { id, tenantId, status: { in: ["SENDING", "SCHEDULED"] } }, data: { status: "PAUSED" } });
  if (result.count === 0) return { success: false, error: "La campagna non è in invio." };
  revalidatePath(`/dashboard/campaigns/${id}`);
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

export async function resumeCampaign(id: string): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const campaign = await prisma.campaign.findFirst({ where: { id, tenantId, status: "PAUSED" } });
  if (!campaign) return { success: false, error: "La campagna non è in pausa." };
  if (!(await hasActiveWhatsapp(tenantId))) return { success: false, error: "WhatsApp non è collegato." };
  // In pausa prima di partire (programmata): riparte da capo, fissando le destinatarie.
  if (!campaign.startedAt) {
    await prisma.campaign.update({ where: { id }, data: { status: "DRAFT" } });
    const started = await startCampaign(id);
    if (!started.ok) return { success: false, error: started.error };
  } else {
    await prisma.campaign.update({ where: { id }, data: { status: "SENDING", nextBatchAt: new Date() } });
  }
  revalidatePath(`/dashboard/campaigns/${id}`);
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

export async function deleteCampaign(id: string): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const result = await prisma.campaign.deleteMany({ where: { id, tenantId, status: { not: "SENDING" } } });
  if (result.count === 0) return { success: false, error: "Metti prima in pausa la campagna." };
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}
