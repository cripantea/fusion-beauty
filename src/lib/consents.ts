import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { appointmentServiceIds } from "@/lib/appointment-services";
import { prisma } from "@/lib/prisma";

/**
 * Consensi informati legati ai trattamenti (es. laser 808): un modello vale per tutti i
 * trattamenti collegati e una firma resta valida per tutti gli appuntamenti futuri,
 * finché non viene revocata o il centro cambia il testo (nuova versione).
 * Senza sessione: usato anche dalla prenotazione online.
 */

/** Modelli attivi di trattamento che valgono per questi trattamenti (vecchio campo singolo o lista). */
function treatmentTemplatesWhere(tenantId: string, serviceIds: string[]): Prisma.ConsentTemplateWhereInput {
  return {
    tenantId,
    isActive: true,
    type: "TREATMENT",
    OR: [{ serviceId: { in: serviceIds } }, { services: { some: { id: { in: serviceIds } } } }],
  };
}

export type ServiceConsentStatus = {
  templateId: string;
  title: string;
  version: number;
  /** Firma valida per la versione attuale (null = da firmare). */
  signed: { recordId: string; signedAt: Date | null; hasPdf: boolean } | null;
  /** Link già creato e non ancora firmato, per la versione attuale. */
  pendingToken: string | null;
};

/** Stato dei consensi richiesti da questi trattamenti per una cliente. */
export async function getServiceConsentStatus(
  tenantId: string,
  clientId: string,
  serviceIds: string[]
): Promise<ServiceConsentStatus[]> {
  if (serviceIds.length === 0) return [];

  const templates = await prisma.consentTemplate.findMany({
    where: treatmentTemplatesWhere(tenantId, serviceIds),
    orderBy: { title: "asc" },
    select: { id: true, title: true, version: true },
  });
  if (templates.length === 0) return [];

  const records = await prisma.consentRecord.findMany({
    where: {
      tenantId,
      clientId,
      templateId: { in: templates.map((template) => template.id) },
      status: { in: ["SIGNED", "PENDING"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, templateId: true, templateVersion: true, status: true, granted: true, signedAt: true, pdfKey: true, token: true },
  });

  return templates.map((template) => {
    const current = records.filter(
      (record) => record.templateId === template.id && record.templateVersion === template.version
    );
    const signed = current.find((record) => record.status === "SIGNED" && record.granted);
    const pending = current.find((record) => record.status === "PENDING" && record.token);

    return {
      templateId: template.id,
      title: template.title,
      version: template.version,
      signed: signed ? { recordId: signed.id, signedAt: signed.signedAt, hasPdf: signed.pdfKey !== null } : null,
      pendingToken: pending?.token ?? null,
    };
  });
}

/**
 * Link da firmare per un modello: si riusa quello ancora aperto della versione attuale,
 * altrimenti se ne crea uno nuovo (record PENDING con lo snapshot del testo).
 */
export async function ensureConsentLink(
  tenantId: string,
  clientId: string,
  templateId: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const [template, client] = await Promise.all([
    prisma.consentTemplate.findFirst({
      where: { id: templateId, tenantId },
      select: { id: true, title: true, body: true, version: true },
    }),
    prisma.client.findFirst({ where: { id: clientId, tenantId }, select: { id: true } }),
  ]);
  if (!template) return { ok: false, error: "Modello non trovato." };
  if (!client) return { ok: false, error: "Cliente non trovata." };

  const pending = await prisma.consentRecord.findFirst({
    where: { tenantId, clientId: client.id, templateId: template.id, templateVersion: template.version, status: "PENDING", token: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  if (pending?.token) return { ok: true, token: pending.token };

  const token = randomUUID();
  await prisma.consentRecord.create({
    data: {
      tenantId,
      clientId: client.id,
      templateId: template.id,
      status: "PENDING",
      token,
      templateVersion: template.version,
      titleSnapshot: template.title,
      bodySnapshot: template.body,
    },
  });
  return { ok: true, token };
}

/**
 * Dopo un nuovo appuntamento: per ogni consenso richiesto dai suoi trattamenti che la cliente
 * non ha ancora firmato si prepara il link (non si manda nulla). Non blocca mai la prenotazione.
 */
export async function prepareConsentLinks(tenantId: string, clientId: string, serviceIds: string | string[]) {
  try {
    const statuses = await getServiceConsentStatus(tenantId, clientId, Array.isArray(serviceIds) ? serviceIds : [serviceIds]);
    for (const status of statuses) {
      if (status.signed || status.pendingToken) continue;
      await ensureConsentLink(tenantId, clientId, status.templateId);
    }
  } catch (error) {
    console.error("[consents] failed to prepare consent links", error);
  }
}

type AppointmentForConsent = {
  id: string;
  clientId: string;
  serviceId: string;
  status: string;
  /** Altri trattamenti dello stesso appuntamento (es. Manicure + Laser: serve il consenso del laser). */
  extraServices?: { serviceId: string }[];
};

/** Appuntamenti (tra quelli dati) per cui manca un consenso richiesto da uno dei trattamenti. */
export async function findAppointmentsMissingConsent(
  tenantId: string,
  appointments: AppointmentForConsent[]
): Promise<Set<string>> {
  // Solo un avviso: se il controllo non riesce, agenda e "Oggi" si aprono lo stesso.
  return missingConsentFor(tenantId, appointments).catch((error) => {
    console.error("[consents] controllo consensi non riuscito", error);
    return new Set<string>();
  });
}

async function missingConsentFor(
  tenantId: string,
  appointments: AppointmentForConsent[]
): Promise<Set<string>> {
  const active = appointments.filter((appointment) => appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW");
  const missing = new Set<string>();
  if (active.length === 0) return missing;

  const serviceIds = [...new Set(active.flatMap((appointment) => appointmentServiceIds(appointment)))];
  const templates = await prisma.consentTemplate.findMany({
    where: treatmentTemplatesWhere(tenantId, serviceIds),
    select: { id: true, version: true, serviceId: true, services: { where: { id: { in: serviceIds } }, select: { id: true } } },
  });
  if (templates.length === 0) return missing;

  const signed = await prisma.consentRecord.findMany({
    where: {
      tenantId,
      clientId: { in: [...new Set(active.map((appointment) => appointment.clientId))] },
      templateId: { in: templates.map((template) => template.id) },
      status: "SIGNED",
      granted: true,
    },
    select: { clientId: true, templateId: true, templateVersion: true },
  });
  const valid = new Set(
    signed
      .filter((record) => templates.some((template) => template.id === record.templateId && template.version === record.templateVersion))
      .map((record) => `${record.clientId}:${record.templateId}`)
  );

  for (const appointment of active) {
    const ids = appointmentServiceIds(appointment);
    const required = templates.filter(
      (template) =>
        (template.serviceId !== null && ids.includes(template.serviceId)) ||
        template.services.some((service) => ids.includes(service.id))
    );
    if (required.some((template) => !valid.has(`${appointment.clientId}:${template.id}`))) {
      missing.add(appointment.id);
    }
  }
  return missing;
}
