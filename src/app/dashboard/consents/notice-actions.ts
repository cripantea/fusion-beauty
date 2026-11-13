"use server";

import { getBaseUrl } from "@/lib/app-url";
import { appointmentServiceIds } from "@/lib/appointment-services";
import { getTenantContext } from "@/lib/auth-context";
import { ensureConsentLink, getServiceConsentStatus } from "@/lib/consents";
import { whatsappUrl } from "@/lib/format";
import { listTemplates } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";
import { hasActiveWhatsapp, sendWhatsappTemplate } from "@/lib/whatsapp";

export type ConsentNoticeItem = {
  templateId: string;
  title: string;
  signed: { recordId: string; signedAt: Date | null; hasPdf: boolean } | null;
};

/**
 * Consensi richiesti dai trattamenti: di un appuntamento (`serviceIds`, tutti i suoi trattamenti)
 * oppure, nella scheda cliente, dei suoi appuntamenti da oggi in poi.
 */
export async function getConsentNotices(input: { clientId: string; serviceIds?: string[] }): Promise<ConsentNoticeItem[]> {
  const { tenantId } = await getTenantContext();

  const client = await prisma.client.findFirst({ where: { id: input.clientId, tenantId }, select: { id: true } });
  if (!client) return [];

  let serviceIds: string[];
  if (input.serviceIds?.length) {
    serviceIds = input.serviceIds;
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = await prisma.appointment.findMany({
      where: { tenantId, clientId: client.id, startTime: { gte: today }, status: { in: ["BOOKED", "CONFIRMED"] } },
      select: { serviceId: true, extraServices: { select: { serviceId: true } } },
    });
    serviceIds = [...new Set(upcoming.flatMap((appointment) => appointmentServiceIds(appointment)))];
  }

  const statuses = await getServiceConsentStatus(tenantId, client.id, serviceIds);
  return statuses.map((status) => ({ templateId: status.templateId, title: status.title, signed: status.signed }));
}

export type SendConsentLinkResult =
  | {
      success: true;
      url: string;
      /** Inviato dal numero WhatsApp del centro. */
      sent: boolean;
      /** Se non inviato: wa.me con il messaggio già scritto, da aprire sul telefono. */
      fallbackUrl?: string;
    }
  | { success: false; error: string };

/** Nome del template WhatsApp (servizio) per il consenso: {{1}} nome, {{2}} titolo del consenso, {{3}} link. */
const CONSENT_LINK_TEMPLATE = "consenso_da_firmare";

function consentMessage(firstName: string, title: string, url: string) {
  return (
    `Ciao ${firstName}, prima del trattamento ti chiediamo di leggere e firmare "${title}". ` +
    `Bastano due minuti dal telefono: ${url}`
  );
}

/**
 * Manda alla cliente il link per firmare il consenso: dal numero WhatsApp del centro se il
 * template "consenso_da_firmare" è approvato, altrimenti un wa.me con il messaggio già scritto.
 */
export async function sendConsentLink(input: { clientId: string; templateId: string }): Promise<SendConsentLinkResult> {
  const { tenantId } = await getTenantContext();

  const client = await prisma.client.findFirst({
    where: { id: input.clientId, tenantId },
    select: { id: true, firstName: true, phone: true },
  });
  if (!client) return { success: false, error: "Cliente non trovata." };

  const link = await ensureConsentLink(tenantId, client.id, input.templateId);
  if (!link.ok) return { success: false, error: link.error };

  const record = await prisma.consentRecord.findUniqueOrThrow({ where: { token: link.token }, select: { titleSnapshot: true } });
  const url = `${await getBaseUrl()}/c/${link.token}`;

  const delivered = await deliverOnWhatsapp(tenantId, client, record.titleSnapshot, url, link.token);
  if (delivered) return { success: true, url, sent: true };
  return { success: true, url, sent: false, fallbackUrl: whatsappUrl(client.phone, consentMessage(client.firstName, record.titleSnapshot, url)) };
}

async function deliverOnWhatsapp(
  tenantId: string,
  client: { id: string; firstName: string; phone: string },
  title: string,
  url: string,
  token: string
): Promise<boolean> {
  if (!(await hasActiveWhatsapp(tenantId))) return false;

  const templates = await listTemplates(tenantId);
  if (!templates.ok) return false;
  const template = templates.templates.find((t) => t.name === CONSENT_LINK_TEMPLATE && t.status === "APPROVED");
  if (!template) return false;

  const result = await sendWhatsappTemplate(tenantId, {
    phone: client.phone,
    clientId: client.id,
    templateName: template.name,
    language: template.language,
    templateBody: template.body,
    params: [client.firstName || "-", title, url],
    // Per minuto: blocca il doppio tocco, ma si può rimandare se la cliente lo richiede.
    dedupeKey: `consent-link:${token}:${Math.floor(Date.now() / 60_000)}`,
  });
  // Doppio tocco nello stesso minuto: è già partito. Altri errori: si ripiega su wa.me.
  return result.ok || result.error === "Messaggio già inviato.";
}
