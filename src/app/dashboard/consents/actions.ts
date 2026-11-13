"use server";

import { requireTenantAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import {
  consentTemplateFormSchema,
  parseChecklist,
  type ConsentTemplateFormValues,
  type ConsentTypeValue,
} from "./schema";

export type ConsentTemplateDTO = {
  id: string;
  type: ConsentTypeValue;
  /** Trattamenti collegati (vecchio campo singolo compreso). */
  serviceIds: string[];
  /** Riassunto per la tabella: "Laser 808 — Ascelle" o "16 trattamenti". */
  serviceName: string | null;
  title: string;
  body: string;
  checklist: string[];
  version: number;
  isActive: boolean;
  signedCount: number;
  updatedAt: Date;
};

const templateInclude = {
  service: { select: { id: true, name: true } },
  services: { select: { id: true, name: true }, orderBy: { name: "asc" } },
  _count: { select: { records: true } },
} as const;

function toTemplateDTO(template: {
  id: string;
  type: ConsentTypeValue;
  title: string;
  body: string;
  checklist: string[];
  version: number;
  isActive: boolean;
  updatedAt: Date;
  service: { id: string; name: string } | null;
  services: { id: string; name: string }[];
  _count: { records: number };
}): ConsentTemplateDTO {
  const services = [...template.services];
  if (template.service && !services.some((service) => service.id === template.service?.id)) {
    services.unshift(template.service);
  }
  return {
    id: template.id,
    type: template.type,
    serviceIds: services.map((service) => service.id),
    serviceName:
      services.length === 0 ? null : services.length === 1 ? services[0].name : `${services.length} trattamenti`,
    title: template.title,
    body: template.body,
    checklist: template.checklist,
    version: template.version,
    isActive: template.isActive,
    signedCount: template._count.records,
    updatedAt: template.updatedAt,
  };
}

export async function getConsentTemplates(): Promise<ConsentTemplateDTO[]> {
  const { tenantId } = await requireTenantAdmin();

  const templates = await prisma.consentTemplate.findMany({
    where: { tenantId },
    orderBy: [{ type: "asc" }, { title: "asc" }],
    include: templateInclude,
  });

  return templates.map(toTemplateDTO);
}

export type ConsentTemplateActionResult =
  | { success: true; template: ConsentTemplateDTO }
  | { success: false; error: string };

export type ConsentTemplateDeleteResult = { success: true } | { success: false; error: string };

async function resolveServiceIds(
  tenantId: string,
  values: ConsentTemplateFormValues
): Promise<{ ok: true; serviceIds: string[] } | { ok: false; error: string }> {
  const wanted = [...new Set(values.serviceIds)];
  if (values.type !== "TREATMENT" || wanted.length === 0) {
    return { ok: true, serviceIds: [] };
  }

  const services = await prisma.service.findMany({
    where: { id: { in: wanted }, tenantId },
    select: { id: true },
  });

  return services.length === wanted.length
    ? { ok: true, serviceIds: services.map((service) => service.id) }
    : { ok: false, error: "Trattamento non valido." };
}

export async function createConsentTemplate(
  values: ConsentTemplateFormValues
): Promise<ConsentTemplateActionResult> {
  const { tenantId } = await requireTenantAdmin();

  const parsed = consentTemplateFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const services = await resolveServiceIds(tenantId, parsed.data);
  if (!services.ok) {
    return { success: false, error: services.error };
  }

  const template = await prisma.consentTemplate.create({
    data: {
      tenantId,
      type: parsed.data.type,
      services: { connect: services.serviceIds.map((id) => ({ id })) },
      title: parsed.data.title,
      body: parsed.data.body,
      checklist: parsed.data.type === "TREATMENT" ? parseChecklist(parsed.data.checklist) : [],
      isActive: parsed.data.isActive,
    },
    include: templateInclude,
  });

  return { success: true, template: toTemplateDTO(template) };
}

export async function updateConsentTemplate(
  id: string,
  values: ConsentTemplateFormValues
): Promise<ConsentTemplateActionResult> {
  const { tenantId } = await requireTenantAdmin();

  const parsed = consentTemplateFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const existing = await prisma.consentTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) {
    return { success: false, error: "Modello non trovato." };
  }

  // Il tipo non cambia dopo la creazione: i record già firmati si riferiscono a quel tipo.
  if (existing.type !== parsed.data.type) {
    return { success: false, error: "Il tipo di consenso non può essere modificato." };
  }

  const services = await resolveServiceIds(tenantId, parsed.data);
  if (!services.ok) {
    return { success: false, error: services.error };
  }

  // Il testo (o le domande di salute) cambia → nuova versione: le firme vecchie non
  // valgono più per i prossimi appuntamenti. I record firmati conservano il loro snapshot.
  const checklist = parsed.data.type === "TREATMENT" ? parseChecklist(parsed.data.checklist) : [];
  const contentChanged =
    existing.title !== parsed.data.title ||
    existing.body !== parsed.data.body ||
    existing.checklist.join("\n") !== checklist.join("\n");

  const template = await prisma.consentTemplate.update({
    where: { id },
    data: {
      // Il vecchio trattamento singolo confluisce nella lista.
      serviceId: null,
      services: { set: services.serviceIds.map((serviceId) => ({ id: serviceId })) },
      title: parsed.data.title,
      body: parsed.data.body,
      checklist,
      isActive: parsed.data.isActive,
      ...(contentChanged ? { version: { increment: 1 } } : {}),
    },
    include: templateInclude,
  });

  return { success: true, template: toTemplateDTO(template) };
}

export async function toggleConsentTemplateStatus(
  id: string,
  isActive: boolean
): Promise<ConsentTemplateActionResult> {
  const { tenantId } = await requireTenantAdmin();

  const result = await prisma.consentTemplate.updateMany({ where: { id, tenantId }, data: { isActive } });
  if (result.count === 0) {
    return { success: false, error: "Modello non trovato." };
  }

  const template = await prisma.consentTemplate.findFirstOrThrow({
    where: { id, tenantId },
    include: templateInclude,
  });

  return { success: true, template: toTemplateDTO(template) };
}

/** Elimina solo modelli mai usati: quelli con consensi registrati vanno disattivati. */
export async function deleteConsentTemplate(id: string): Promise<ConsentTemplateDeleteResult> {
  const { tenantId } = await requireTenantAdmin();

  const template = await prisma.consentTemplate.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { records: true } } },
  });
  if (!template) {
    return { success: false, error: "Modello non trovato." };
  }

  if (template._count.records > 0) {
    return {
      success: false,
      error: "Questo modello ha consensi registrati: disattivalo invece di eliminarlo.",
    };
  }

  await prisma.consentTemplate.deleteMany({ where: { id, tenantId } });

  return { success: true };
}
