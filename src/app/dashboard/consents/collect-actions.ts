"use server";

import { createHash, randomUUID } from "node:crypto";

import { headers } from "next/headers";

import { cleanAnamnesis, formatAnamnesis, isAnamnesisAnswered } from "@/lib/anamnesis";
import { getBaseUrl } from "@/lib/app-url";
import { getTenantContext } from "@/lib/auth-context";
import { generateConsentPdf } from "@/lib/consent-pdf";
import { appointmentServiceIds, extraServicesSelect } from "@/lib/appointment-services";
import { ensureConsentLink } from "@/lib/consents";
import { prisma } from "@/lib/prisma";
import { removeStorageFile, writeStorageFile } from "@/lib/storage";

import {
  collectConsentSchema,
  consentTypeLabels,
  PNG_DATA_URL_PREFIX,
  type CollectConsentValues,
  type ConsentTypeValue,
} from "./schema";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const MAX_SIGNATURE_BYTES = 700_000;

export type CollectableTemplateDTO = {
  id: string;
  type: ConsentTypeValue;
  title: string;
  body: string;
  version: number;
  serviceName: string | null;
  /** Domande di salute da spuntare prima della firma. */
  checklist: string[];
  alreadySigned: boolean;
};

/** Nome del trattamento collegato, o "N trattamenti" se il modello ne ha più di uno. */
function linkedServicesLabel(template: {
  service: { id: string; name: string } | null;
  services: { id: string; name: string }[];
}) {
  const names = new Set(template.services.map((service) => service.name));
  if (template.service) names.add(template.service.name);
  if (names.size === 0) return null;
  return names.size === 1 ? [...names][0] : `${names.size} trattamenti`;
}

const linkedServicesInclude = {
  service: { select: { id: true, name: true } },
  services: { select: { id: true, name: true } },
} as const;

/**
 * Modelli attivi proponibili a una cliente. Con `serviceIds` (trattamenti dell'appuntamento) i
 * modelli di trattamento sono limitati a quelli generici o di uno di quei trattamenti.
 */
export async function getCollectableTemplates(input: {
  clientId: string;
  serviceIds?: string[];
  appointmentId?: string;
}): Promise<CollectableTemplateDTO[]> {
  const { tenantId } = await getTenantContext();

  const client = await prisma.client.findFirst({
    where: { id: input.clientId, tenantId },
    select: { id: true },
  });
  if (!client) {
    return [];
  }

  const templates = await prisma.consentTemplate.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(input.serviceIds?.length
        ? {
            OR: [
              { type: { not: "TREATMENT" as const } },
              { serviceId: null, services: { none: {} } },
              { serviceId: { in: input.serviceIds } },
              { services: { some: { id: { in: input.serviceIds } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ type: "asc" }, { title: "asc" }],
    include: linkedServicesInclude,
  });

  const signed = await prisma.consentRecord.findMany({
    where: {
      tenantId,
      clientId: client.id,
      status: "SIGNED",
      templateId: { in: templates.map((template) => template.id) },
    },
    select: { templateId: true, templateVersion: true },
  });

  // Una firma vale per tutti gli appuntamenti finché il testo non cambia (o viene revocata).
  return templates.map((template) => ({
    id: template.id,
    type: template.type,
    title: template.title,
    body: template.body,
    version: template.version,
    serviceName: linkedServicesLabel(template),
    checklist: template.type === "TREATMENT" ? template.checklist : [],
    alreadySigned: signed.some(
      (record) => record.templateId === template.id && record.templateVersion === template.version
    ),
  }));
}

export type CollectConsentResult = { success: true } | { success: false; error: string };

function decodeSignature(dataUrl: string): Buffer | null {
  const buffer = Buffer.from(dataUrl.slice(PNG_DATA_URL_PREFIX.length), "base64");

  if (buffer.length === 0 || buffer.length > MAX_SIGNATURE_BYTES) {
    return null;
  }

  return buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC) ? buffer : null;
}

export async function collectConsent(values: CollectConsentValues): Promise<CollectConsentResult> {
  const { user, tenantId } = await getTenantContext();

  const parsed = collectConsentSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Controlla i dati inseriti." };
  }
  const input = parsed.data;

  const [client, template, tenant] = await Promise.all([
    prisma.client.findFirst({ where: { id: input.clientId, tenantId } }),
    prisma.consentTemplate.findFirst({
      where: { id: input.templateId, tenantId, isActive: true },
      include: linkedServicesInclude,
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
  ]);
  if (!client) {
    return { success: false, error: "Cliente non trovato." };
  }
  if (!template) {
    return { success: false, error: "Modello di consenso non disponibile." };
  }

  // Solo i consensi per trattamento si agganciano a un appuntamento.
  let appointmentId: string | null = null;
  let appointmentStart: Date | null = null;
  let appointmentServiceName: string | null = null;
  if (input.appointmentId && template.type === "TREATMENT") {
    const appointment = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, tenantId, clientId: client.id },
      select: {
        id: true,
        serviceId: true,
        startTime: true,
        service: { select: { name: true } },
        extraServices: extraServicesSelect,
      },
    });
    if (!appointment) {
      return { success: false, error: "Appuntamento non trovato." };
    }
    // Tutti i trattamenti dell'appuntamento (es. Manicure + Laser: vale il consenso del laser).
    const appointmentServices = [
      { id: appointment.serviceId, name: appointment.service.name },
      ...appointment.extraServices.map((extra) => extra.service),
    ];
    const linkedIds = [template.serviceId, ...template.services.map((service) => service.id)].filter(Boolean);
    const matching = appointmentServices.filter((service) => linkedIds.includes(service.id));
    if (linkedIds.length > 0 && matching.length === 0) {
      return { success: false, error: "Il modello non corrisponde al trattamento dell'appuntamento." };
    }
    appointmentId = appointment.id;
    appointmentStart = appointment.startTime;
    appointmentServiceName = (matching.length > 0 ? matching : appointmentServices).map((service) => service.name).join(" + ");
  }

  const signature = decodeSignature(input.signature);
  if (!signature) {
    return { success: false, error: "Firma non valida." };
  }

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = requestHeaders.get("user-agent");

  const id = randomUUID();
  const signatureKey = `consents/${tenantId}/${id}/signature.png`;
  const pdfKey = `consents/${tenantId}/${id}/consent.pdf`;
  // Con le domande di salute del modello: voci spuntate + nota; altrimenti solo la nota libera.
  const checklist = template.type === "TREATMENT" ? template.checklist : [];
  const anamnesisAnswers = cleanAnamnesis(checklist, {
    conditions: input.conditions ?? [],
    none: input.noConditions === true,
    note: input.anamnesis ?? "",
  });
  if (!isAnamnesisAnswered(checklist, anamnesisAnswers)) {
    return { success: false, error: "Spunta le condizioni di salute oppure \"Nessuna di queste\"." };
  }
  const anamnesis =
    template.type !== "TREATMENT"
      ? null
      : checklist.length > 0
        ? formatAnamnesis(checklist, anamnesisAnswers)
        : input.anamnesis?.trim() || null;
  const granted = template.type === "MARKETING" ? input.granted : true;
  const signedAt = new Date();

  try {
    // Prima il documento, poi il record: nel database non esistono consensi firmati senza PDF.
    const pdf = await generateConsentPdf({
      recordId: id,
      centerName: tenant.name,
      typeLabel: consentTypeLabels[template.type],
      title: template.title,
      body: template.body,
      version: template.version,
      client,
      serviceName: appointmentServiceName ?? linkedServicesLabel(template),
      appointmentStart,
      marketingChoice: template.type === "MARKETING" ? granted : null,
      anamnesis,
      signedAt,
      operatorName: `${user.firstName} ${user.lastName}`,
      ipAddress,
      signaturePng: signature,
    });

    await writeStorageFile(signatureKey, signature);
    await writeStorageFile(pdfKey, pdf);

    await prisma.consentRecord.create({
      data: {
        id,
        tenantId,
        clientId: client.id,
        appointmentId,
        templateId: template.id,
        collectedById: user.id,
        status: "SIGNED",
        templateVersion: template.version,
        titleSnapshot: template.title,
        bodySnapshot: template.body,
        answers: anamnesis ? (checklist.length > 0 ? { anamnesis, ...anamnesisAnswers } : { anamnesis }) : undefined,
        granted,
        signatureKey,
        pdfKey,
        documentHash: createHash("sha256").update(pdf).digest("hex"),
        ipAddress,
        userAgent,
        signedAt,
      },
    });
  } catch (error) {
    console.error("[consents] failed to store signed consent", error);
    await Promise.allSettled([removeStorageFile(signatureKey), removeStorageFile(pdfKey)]);
    return { success: false, error: "Impossibile salvare il consenso. Riprova." };
  }

  return { success: true };
}

export type ClientSelectItem = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export async function getClientsForSelect(): Promise<ClientSelectItem[]> {
  const { tenantId } = await getTenantContext();
  return prisma.client.findMany({
    where: { tenantId },
    select: { id: true, firstName: true, lastName: true, phone: true },
    orderBy: { lastName: "asc" },
    take: 500,
  });
}

export type CreateConsentLinkResult =
  | { success: true; url: string; phone: string | null }
  | { success: false; error: string };

export async function createConsentLink(input: {
  templateId: string;
  clientId: string;
}): Promise<CreateConsentLinkResult> {
  const { tenantId } = await getTenantContext();

  const client = await prisma.client.findFirst({
    where: { id: input.clientId, tenantId },
    select: { id: true, phone: true },
  });
  if (!client) {
    return { success: false, error: "Cliente non trovata." };
  }

  // Se c'è già un link aperto per la versione attuale si riusa quello.
  const link = await ensureConsentLink(tenantId, client.id, input.templateId);
  if (!link.ok) {
    return { success: false, error: link.error };
  }

  return { success: true, url: `${await getBaseUrl()}/c/${link.token}`, phone: client.phone };
}

export type RevokeConsentResult = { success: true } | { success: false; error: string };

/**
 * Revoca un consenso firmato (diritto di revoca GDPR). Il record e il PDF originale restano
 * come prova di ciò che è stato firmato; cambia solo lo stato, con data di revoca.
 */
export async function revokeConsent(recordId: string): Promise<RevokeConsentResult> {
  const { tenantId } = await getTenantContext();

  const result = await prisma.consentRecord.updateMany({
    where: { id: recordId, tenantId, status: "SIGNED" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  if (result.count === 0) {
    return { success: false, error: "Consenso non trovato o già revocato." };
  }

  return { success: true };
}

export type ConsentStateValue = "SIGNED" | "MISSING" | "OUTDATED" | "REVOKED" | "DECLINED";

export type ClientConsentItemDTO = {
  templateId: string;
  /** Ultimo consenso registrato per il modello, se presente. */
  recordId: string | null;
  /** Revocabile: l'ultimo consenso è firmato e accordato. */
  revocable: boolean;
  title: string;
  type: ConsentTypeValue;
  serviceName: string | null;
  state: ConsentStateValue;
  signedAt: Date | null;
  currentVersion: number;
  signedVersion: number | null;
};

export type ClientConsentHistoryDTO = {
  id: string;
  revocable: boolean;
  title: string;
  type: ConsentTypeValue;
  templateVersion: number;
  status: "PENDING" | "SIGNED" | "REVOKED";
  granted: boolean;
  signedAt: Date | null;
  hasPdf: boolean;
};

export type ClientConsentsDTO = {
  items: ClientConsentItemDTO[];
  history: ClientConsentHistoryDTO[];
};

export async function getClientConsents(clientId: string): Promise<ClientConsentsDTO> {
  const { tenantId } = await getTenantContext();

  const [templates, records, appointments] = await Promise.all([
    prisma.consentTemplate.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ type: "asc" }, { title: "asc" }],
      include: linkedServicesInclude,
    }),
    prisma.consentRecord.findMany({
      where: { tenantId, clientId },
      orderBy: { createdAt: "desc" },
      include: { template: { select: { type: true } } },
    }),
    prisma.appointment.findMany({
      where: { tenantId, clientId, status: { not: "CANCELLED" } },
      select: { serviceId: true, extraServices: { select: { serviceId: true } } },
    }),
  ]);

  const clientServiceIds = new Set(appointments.flatMap((appointment) => appointmentServiceIds(appointment)));

  const items: ClientConsentItemDTO[] = [];
  for (const template of templates) {
    // Ordinati dal più recente: il primo è l'ultimo stato per quel modello
    // (i link ancora da firmare non cambiano lo stato).
    const latest = records.find((record) => record.templateId === template.id && record.status !== "PENDING");
    const linkedIds = [template.serviceId, ...template.services.map((service) => service.id)];

    // I consensi per trattamento sono rilevanti solo se la cliente ha quel trattamento
    // (o ne ha già firmato uno): altrimenti sarebbero tutti "mancanti".
    if (
      template.type === "TREATMENT" &&
      !latest &&
      !linkedIds.some((serviceId) => serviceId && clientServiceIds.has(serviceId))
    ) {
      continue;
    }

    let state: ConsentStateValue = "MISSING";
    if (latest) {
      if (latest.status === "REVOKED") state = "REVOKED";
      else if (latest.status === "SIGNED" && !latest.granted) state = "DECLINED";
      else if (latest.status === "SIGNED" && latest.templateVersion < template.version) state = "OUTDATED";
      else if (latest.status === "SIGNED") state = "SIGNED";
    }

    items.push({
      templateId: template.id,
      recordId: latest?.id ?? null,
      revocable: latest?.status === "SIGNED" && latest.granted,
      title: template.title,
      type: template.type,
      serviceName: linkedServicesLabel(template),
      state,
      signedAt: latest?.signedAt ?? null,
      currentVersion: template.version,
      signedVersion: latest?.templateVersion ?? null,
    });
  }

  return {
    items,
    history: records.slice(0, 10).map((record) => ({
      id: record.id,
      revocable: record.status === "SIGNED" && record.granted,
      title: record.titleSnapshot,
      type: record.template.type,
      templateVersion: record.templateVersion,
      status: record.status,
      granted: record.granted,
      signedAt: record.signedAt,
      hasPdf: record.pdfKey !== null,
    })),
  };
}
