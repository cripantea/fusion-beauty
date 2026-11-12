"use server";

import { getTenantContext } from "@/lib/auth-context";
import { normalizePhoneForWhatsapp } from "@/lib/format";
import { isFusionWaConfigured, listTemplates } from "@/lib/fusion-wa";
import { parseStoredSteps, walkSteps } from "@/lib/automations";
import { prisma } from "@/lib/prisma";
import { sendWhatsappTemplate, sendWhatsappText } from "@/lib/whatsapp";
import { renderVariables, TEMPLATE_VARIABLES } from "@/lib/whatsapp-shared";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type ConversationDTO = {
  phone: string;
  clientId: string | null;
  name: string;
  lastMessage: string;
  lastAt: string;
  lastDirection: "INBOUND" | "OUTBOUND";
  unread: number;
};

export type MessageDTO = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: "RECEIVED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  body: string;
  templateName: string | null;
  /** Partito da solo (conferma, promemoria…), non scritto da qualcuno del centro. */
  automatic: boolean;
  error: string | null;
  createdAt: string;
};

export type ThreadDTO = {
  messages: MessageDTO[];
  /** Testo libero consentito: la cliente ha scritto nelle ultime 24 ore. */
  windowOpen: boolean;
};

export async function getWhatsappStatus(): Promise<{ connected: boolean; phoneNumber: string | null }> {
  const { tenantId } = await getTenantContext();
  if (!isFusionWaConfigured()) return { connected: false, phoneNumber: null };
  const connection = await prisma.whatsappConnection.findUnique({ where: { tenantId }, select: { phoneNumber: true } });
  return { connected: Boolean(connection), phoneNumber: connection?.phoneNumber ?? null };
}

export async function getConversations(): Promise<ConversationDTO[]> {
  const { tenantId } = await getTenantContext();

  // Ultimo messaggio per numero, più i non letti.
  const latest = await prisma.$queryRaw<
    { phone: string; body: string; direction: "INBOUND" | "OUTBOUND"; createdAt: Date; clientId: string | null; unread: bigint }[]
  >`
    SELECT DISTINCT ON (m.phone) m.phone, m.body, m.direction, m."createdAt",
      (SELECT c."clientId" FROM whatsapp_messages c WHERE c."tenantId" = m."tenantId" AND c.phone = m.phone AND c."clientId" IS NOT NULL ORDER BY c."createdAt" DESC LIMIT 1) AS "clientId",
      (SELECT COUNT(*) FROM whatsapp_messages u WHERE u."tenantId" = m."tenantId" AND u.phone = m.phone AND u.direction = 'INBOUND' AND u."readAt" IS NULL) AS unread
    FROM whatsapp_messages m
    WHERE m."tenantId" = ${tenantId}
    ORDER BY m.phone, m."createdAt" DESC`;

  const clientIds = latest.map((row) => row.clientId).filter((id): id is string => Boolean(id));
  const clients = await prisma.client.findMany({
    where: { tenantId, id: { in: clientIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const names = new Map(clients.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]));

  return latest
    .map((row) => ({
      phone: row.phone,
      clientId: row.clientId,
      name: (row.clientId && names.get(row.clientId)) || `+${row.phone}`,
      lastMessage: row.body,
      lastAt: row.createdAt.toISOString(),
      lastDirection: row.direction,
      unread: Number(row.unread),
    }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function getThread(phone: string): Promise<ThreadDTO> {
  const { tenantId } = await getTenantContext();
  const messages = await prisma.whatsappMessage.findMany({
    where: { tenantId, phone },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  await prisma.whatsappMessage.updateMany({
    where: { tenantId, phone, direction: "INBOUND", readAt: null },
    data: { readAt: new Date() },
  });
  const lastInbound = [...messages].reverse().find((m) => m.direction === "INBOUND");
  return {
    messages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      status: m.status,
      body: m.body,
      templateName: m.templateName,
      automatic: m.dedupeKey !== null,
      error: m.error,
      createdAt: m.createdAt.toISOString(),
    })),
    windowOpen: Boolean(lastInbound && Date.now() - lastInbound.createdAt.getTime() < WINDOW_MS),
  };
}

export async function sendReply(phone: string, body: string): Promise<{ success: true } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();
  const text = body.trim();
  if (!text) return { success: false, error: "Scrivi un messaggio." };
  if (text.length > 4000) return { success: false, error: "Messaggio troppo lungo." };
  const result = await sendWhatsappText(tenantId, { phone, body: text });
  return result.ok ? { success: true } : { success: false, error: result.error };
}

export type InboxTemplate = {
  name: string;
  language: string;
  body: string;
  variableCount: number;
  /** Valori già noti per ogni variabile (vuoto = da scrivere). */
  defaults: string[];
  /** Cosa va scritto in ogni variabile, se si sa (es. "Ora appuntamento (es. 15:30)"). */
  hints: string[];
};

/**
 * Messaggi pronti per la chat. Se un template è usato da un messaggio automatico,
 * le variabili con un significato noto (nome, centro, link…) si compilano da sole.
 */
export async function getApprovedTemplates(clientId?: string): Promise<{ success: true; templates: InboxTemplate[] } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();
  const result = await listTemplates(tenantId);
  if (!result.ok) return { success: false, error: result.error };

  const [automations, tenant, client] = await Promise.all([
    prisma.automation.findMany({ where: { tenantId }, select: { steps: true } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, slug: true } }),
    clientId ? prisma.client.findFirst({ where: { id: clientId, tenantId }, select: { firstName: true, lastName: true } }) : null,
  ]);
  // Variabili già scelte nelle automazioni per lo stesso template.
  const mappings: { templateName: string; language: string; params: string[] }[] = [];
  for (const automation of automations) {
    walkSteps(parseStoredSteps(automation.steps), (step) => {
      if (step.type === "SEND_TEMPLATE" && step.templateName) mappings.push(step);
    });
  }
  const base = (process.env.APP_BASE_URL ?? "https://beauty.fusionsoft.it").replace(/\/$/, "");
  const known = { nome: client?.firstName ?? "", cognome: client?.lastName ?? "", centro: tenant.name, prenota: `${base}/embed/${tenant.slug}` };

  return {
    success: true,
    templates: result.templates
      .filter((t) => t.status === "APPROVED")
      .map((t) => {
        const mapping = mappings.find((a) => a.templateName === t.name && a.language === t.language)?.params ?? [];
        const defaults = Array.from({ length: t.variableCount }, (_, i) => {
          const param = mapping[i] ?? (i === 0 ? "{{nome}}" : "");
          const filled = renderVariables(param, known);
          // Restano da scrivere le parti non note (es. {{data}} senza un appuntamento).
          return /\{\{/.test(filled) ? "" : filled;
        });
        const hints = Array.from({ length: t.variableCount }, (_, i) => {
          const key = /^\{\{([a-z]+)\}\}$/.exec(mapping[i] ?? "")?.[1];
          return TEMPLATE_VARIABLES.find((v) => v.key === key)?.label ?? "";
        });
        return { name: t.name, language: t.language, body: t.body, variableCount: t.variableCount, defaults, hints };
      }),
  };
}

/** Template a una cliente o a un numero (l'unico modo per scrivere fuori dalle 24 ore). */
export async function sendTemplateMessage(input: {
  phone?: string;
  clientId?: string;
  templateName: string;
  language: string;
  params: string[];
}): Promise<{ success: true; phone: string } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();

  const client = input.clientId
    ? await prisma.client.findFirst({ where: { id: input.clientId, tenantId }, select: { id: true, firstName: true, lastName: true, phone: true } })
    : null;
  if (input.clientId && !client) return { success: false, error: "Cliente non trovata." };
  const phone = client?.phone ?? input.phone;
  if (!phone || phone.replace(/\D/g, "").length < 8) return { success: false, error: "Numero non valido." };

  const templates = await listTemplates(tenantId);
  if (!templates.ok) return { success: false, error: templates.error };
  const template = templates.templates.find((t) => t.name === input.templateName && t.language === input.language && t.status === "APPROVED");
  if (!template) return { success: false, error: "Template non approvato." };

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
  const vars = { nome: client?.firstName ?? "", cognome: client?.lastName ?? "", centro: tenant.name };
  const params = Array.from({ length: template.variableCount }, (_, i) => renderVariables(input.params[i] ?? "", vars).trim() || "-");

  const result = await sendWhatsappTemplate(tenantId, {
    phone,
    clientId: client?.id,
    templateName: template.name,
    language: template.language,
    templateBody: template.body,
    params,
  });
  return result.ok ? { success: true, phone: normalizePhoneForWhatsapp(phone) } : { success: false, error: result.error };
}

export async function searchClientsForChat(query: string) {
  const { tenantId } = await getTenantContext();
  const q = query.trim();
  if (q.length < 2) return [];
  return prisma.client.findMany({
    where: {
      tenantId,
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q.replace(/\s/g, "") } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, phone: true },
    take: 8,
  });
}
