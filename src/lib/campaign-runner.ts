import type { Prisma } from "@/generated/prisma/client";
import { nextSendTime } from "@/lib/automation-engine";
import { parseStoredAudience, type Audience } from "@/lib/campaigns";
import { normalizePhoneForWhatsapp } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hasActiveWhatsapp, sendWhatsappTemplate } from "@/lib/whatsapp";
import { renderVariables } from "@/lib/whatsapp-shared";

/**
 * Invio delle campagne WhatsApp (come campaign-runner.ts del CRM, senza coda
 * dedicata): all'avvio si fissa l'elenco delle destinatarie, poi il worker
 * manda uno scaglione ogni N minuti, solo tra le 9 e le 20. La presa in carico
 * dello scaglione (nextBatchAt → null) impedisce a due giri di inviarlo due
 * volte, e la dedupeKey del messaggio fa il resto.
 * Importato anche dal worker (tsx): niente "server-only".
 */

const STUCK_AFTER_MS = 15 * 60_000;

/** Clienti del pubblico scelto, una per numero di telefono. */
export async function audienceClients(tenantId: string, audience: Audience, now = new Date()) {
  const day = 86_400_000;
  const and: Prisma.ClientWhereInput[] = [];

  if (audience.segment === "NEW" && audience.days) and.push({ createdAt: { gte: new Date(now.getTime() - audience.days * day) } });
  if (audience.segment === "INTEREST" && audience.interest) and.push({ interests: { has: audience.interest } });
  if (audience.segment === "SERVICE" && audience.serviceIds?.length) {
    and.push({ appointments: { some: { status: "COMPLETED", serviceId: { in: audience.serviceIds } } } });
  }
  if (audience.segment === "INACTIVE" && audience.days) {
    const limit = new Date(now.getTime() - audience.days * day);
    // Almeno una visita, e nessuna più recente del limite
    and.push({ appointments: { some: { status: "COMPLETED" } } });
    and.push({ appointments: { none: { status: "COMPLETED", startTime: { gte: limit } } } });
  }
  if (audience.excludeUpcoming) {
    and.push({ appointments: { none: { status: { in: ["BOOKED", "CONFIRMED"] }, startTime: { gt: now } } } });
  }
  if (audience.marketingConsentOnly) {
    and.push({ consents: { some: { status: "SIGNED", granted: true, revokedAt: null, template: { type: "MARKETING" } } } });
  }

  let clients = await prisma.client.findMany({
    where: { tenantId, phone: { not: "" }, AND: and },
    select: { id: true, firstName: true, lastName: true, phone: true, dateOfBirth: true },
    orderBy: { createdAt: "asc" },
  });
  if (audience.segment === "BIRTHDAY_MONTH" && audience.month) {
    clients = clients.filter((c) => c.dateOfBirth && c.dateOfBirth.getUTCMonth() + 1 === audience.month);
  }

  const seen = new Set<string>();
  return clients.filter((c) => {
    const phone = normalizePhoneForWhatsapp(c.phone);
    if (phone.length < 10 || seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });
}

/** Da bozza o programmata a "in invio": fissa le destinatarie. */
export async function startCampaign(campaignId: string): Promise<{ ok: true; recipients: number } | { ok: false; error: string }> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, error: "Campagna non trovata." };
  const claimed = await prisma.campaign.updateMany({
    where: { id: campaignId, status: { in: ["DRAFT", "SCHEDULED"] } },
    data: { status: "SENDING", startedAt: new Date(), nextBatchAt: null },
  });
  if (claimed.count !== 1) return { ok: false, error: "La campagna è già partita." };

  const clients = await audienceClients(campaign.tenantId, parseStoredAudience(campaign.audience));
  if (clients.length === 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "FAILED", totalRecipients: 0, completedAt: new Date() } });
    return { ok: false, error: "Nessuna cliente corrisponde al pubblico scelto." };
  }
  for (let i = 0; i < clients.length; i += 5000) {
    await prisma.campaignRecipient.createMany({
      data: clients.slice(i, i + 5000).map((c) => ({ campaignId, clientId: c.id })),
      skipDuplicates: true,
    });
  }
  await prisma.campaign.update({ where: { id: campaignId }, data: { totalRecipients: clients.length, nextBatchAt: new Date() } });
  return { ok: true, recipients: clients.length };
}

/** Giro del worker (ogni minuto): partenze programmate e scaglioni dovuti. */
export async function runDueCampaigns(now = new Date()) {
  const scheduled = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now }, tenant: { isActive: true } },
    select: { id: true },
  });
  for (const { id } of scheduled) await startCampaign(id);

  // Scaglione preso in carico ma mai finito (worker fermato a metà): si riprende.
  await prisma.campaign.updateMany({
    where: { status: "SENDING", nextBatchAt: null, updatedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } },
    data: { nextBatchAt: now },
  });

  const due = await prisma.campaign.findMany({
    where: { status: "SENDING", nextBatchAt: { lte: now }, tenant: { isActive: true } },
    select: { id: true, nextBatchAt: true },
  });
  for (const campaign of due) {
    const claimed = await prisma.campaign.updateMany({
      where: { id: campaign.id, status: "SENDING", nextBatchAt: campaign.nextBatchAt },
      data: { nextBatchAt: null },
    });
    if (claimed.count !== 1) continue;
    try {
      await sendBatch(campaign.id, now);
    } catch (err) {
      console.error(`[campagne] scaglione di ${campaign.id} non riuscito:`, err);
      await prisma.campaign.update({ where: { id: campaign.id }, data: { nextBatchAt: new Date(now.getTime() + 5 * 60_000) } });
    }
  }
}

async function sendBatch(campaignId: string, now: Date) {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { tenant: { select: { name: true, slug: true } } },
  });

  // Di notte non si scrive alle clienti: si riparte all'apertura della fascia.
  const opensAt = nextSendTime(now);
  if (opensAt.getTime() > now.getTime()) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { nextBatchAt: opensAt } });
    return;
  }
  if (!(await hasActiveWhatsapp(campaign.tenantId))) {
    // Numero scollegato: la campagna si mette in pausa invece di segnare tutte come fallite.
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
    return;
  }

  const batch = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "PENDING" },
    include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    orderBy: { id: "asc" },
    take: campaign.batchSize,
  });

  const base = (process.env.APP_BASE_URL ?? "https://beauty.fusionsoft.it").replace(/\/$/, "");
  for (const recipient of batch) {
    // Pausa chiesta a metà scaglione: ci si ferma subito.
    const current = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (current?.status !== "SENDING") return;

    const vars = {
      nome: recipient.client.firstName,
      cognome: recipient.client.lastName,
      centro: campaign.tenant.name,
      prenota: `${base}/embed/${campaign.tenant.slug}`,
    };
    const params = campaign.params.map((p) => renderVariables(p, vars).replace(/\{\{[a-z]+\}\}/gi, "").trim() || "-");
    const outcome = await sendWhatsappTemplate(campaign.tenantId, {
      phone: recipient.client.phone,
      clientId: recipient.client.id,
      templateName: campaign.templateName,
      language: campaign.language,
      templateBody: campaign.templateBody,
      params,
      dedupeKey: `campaign:${campaignId}:${recipient.client.id}`,
    });
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: outcome.ok ? "SENT" : "FAILED",
        messageId: outcome.messageId ?? null,
        error: outcome.ok ? null : outcome.error,
        sentAt: new Date(),
      },
    });
  }

  const left = await prisma.campaignRecipient.count({ where: { campaignId, status: "PENDING" } });
  await prisma.campaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: left === 0 ? { status: "COMPLETED", completedAt: new Date() } : { nextBatchAt: new Date(Date.now() + campaign.batchIntervalMinutes * 60_000) },
  });
}

/** Numeri della campagna: inviati, consegnati, letti, falliti, risposte (entro 7 giorni). */
export async function campaignStats(campaignId: string) {
  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId },
    select: { status: true, sentAt: true, clientId: true, message: { select: { status: true } } },
  });
  const stats = { total: recipients.length, pending: 0, sent: 0, delivered: 0, read: 0, failed: 0, replied: 0 };
  for (const r of recipients) {
    if (r.status === "PENDING") stats.pending++;
    if (r.status === "FAILED" || r.message?.status === "FAILED") {
      stats.failed++;
      continue;
    }
    if (r.status !== "SENT") continue;
    stats.sent++;
    if (r.message?.status === "DELIVERED" || r.message?.status === "READ") stats.delivered++;
    if (r.message?.status === "READ") stats.read++;
  }
  const sent = recipients.filter((r) => r.status === "SENT" && r.sentAt);
  if (sent.length) {
    const firstSent = new Date(Math.min(...sent.map((r) => r.sentAt!.getTime())));
    const replies = await prisma.whatsappMessage.findMany({
      where: { clientId: { in: sent.map((r) => r.clientId) }, direction: "INBOUND", createdAt: { gte: firstSent } },
      select: { clientId: true, createdAt: true },
    });
    const sentAt = new Map(sent.map((r) => [r.clientId, r.sentAt!.getTime()]));
    const repliedClients = new Set(
      replies
        .filter((m) => {
          const at = sentAt.get(m.clientId!);
          return at !== undefined && m.createdAt.getTime() >= at && m.createdAt.getTime() <= at + 7 * 86_400_000;
        })
        .map((m) => m.clientId)
    );
    stats.replied = repliedClients.size;
  }
  return stats;
}
