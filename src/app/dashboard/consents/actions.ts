"use server";

import { requireTenantAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import {
  consentTemplateFormSchema,
  type ConsentTemplateFormValues,
  type ConsentTypeValue,
} from "./schema";

export type ConsentTemplateDTO = {
  id: string;
  type: ConsentTypeValue;
  serviceId: string | null;
  serviceName: string | null;
  title: string;
  body: string;
  version: number;
  isActive: boolean;
  signedCount: number;
  updatedAt: Date;
};

const templateInclude = {
  service: { select: { name: true } },
  _count: { select: { records: true } },
} as const;

function toTemplateDTO(template: {
  id: string;
  type: ConsentTypeValue;
  serviceId: string | null;
  title: string;
  body: string;
  version: number;
  isActive: boolean;
  updatedAt: Date;
  service: { name: string } | null;
  _count: { records: number };
}): ConsentTemplateDTO {
  return {
    id: template.id,
    type: template.type,
    serviceId: template.serviceId,
    serviceName: template.service?.name ?? null,
    title: template.title,
    body: template.body,
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

async function resolveServiceId(
  tenantId: string,
  values: ConsentTemplateFormValues
): Promise<{ ok: true; serviceId: string | null } | { ok: false; error: string }> {
  if (values.type !== "TREATMENT" || !values.serviceId) {
    return { ok: true, serviceId: null };
  }

  const service = await prisma.service.findFirst({
    where: { id: values.serviceId, tenantId },
    select: { id: true },
  });

  return service ? { ok: true, serviceId: service.id } : { ok: false, error: "Trattamento non valido." };
}

export async function createConsentTemplate(
  values: ConsentTemplateFormValues
): Promise<ConsentTemplateActionResult> {
  const { tenantId } = await requireTenantAdmin();

  const parsed = consentTemplateFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const service = await resolveServiceId(tenantId, parsed.data);
  if (!service.ok) {
    return { success: false, error: service.error };
  }

  const template = await prisma.consentTemplate.create({
    data: {
      tenantId,
      type: parsed.data.type,
      serviceId: service.serviceId,
      title: parsed.data.title,
      body: parsed.data.body,
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

  const service = await resolveServiceId(tenantId, parsed.data);
  if (!service.ok) {
    return { success: false, error: service.error };
  }

  // Il testo cambia → nuova versione. I record firmati conservano il loro snapshot.
  const contentChanged = existing.title !== parsed.data.title || existing.body !== parsed.data.body;

  const template = await prisma.consentTemplate.update({
    where: { id },
    data: {
      serviceId: service.serviceId,
      title: parsed.data.title,
      body: parsed.data.body,
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
