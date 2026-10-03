"use server";

import { createHash, randomUUID } from "node:crypto";

import { headers } from "next/headers";

import { getTenantContext } from "@/lib/auth-context";
import { generateConsentPdf } from "@/lib/consent-pdf";
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
  alreadySigned: boolean;
};

/**
 * Modelli attivi proponibili a una cliente. Con `serviceId` (appuntamento) i modelli
 * di trattamento sono limitati a quelli generici o dello stesso trattamento.
 */
export async function getCollectableTemplates(input: {
  clientId: string;
  serviceId?: string;
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
      ...(input.serviceId
        ? {
            OR: [
              { type: { not: "TREATMENT" as const } },
              { serviceId: null },
              { serviceId: input.serviceId },
            ],
          }
        : {}),
    },
    orderBy: [{ type: "asc" }, { title: "asc" }],
    include: { service: { select: { name: true } } },
  });

  const signed = await prisma.consentRecord.findMany({
    where: {
      tenantId,
      clientId: client.id,
      status: "SIGNED",
      templateId: { in: templates.map((template) => template.id) },
    },
    select: { templateId: true, templateVersion: true, appointmentId: true },
  });

  return templates.map((template) => ({
    id: template.id,
    type: template.type,
    title: template.title,
    body: template.body,
    version: template.version,
    serviceName: template.service?.name ?? null,
    alreadySigned: signed.some(
      (record) =>
        record.templateId === template.id &&
        record.templateVersion === template.version &&
        (template.type !== "TREATMENT" ||
          !input.appointmentId ||
          record.appointmentId === input.appointmentId)
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
      include: { service: { select: { name: true } } },
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
      },
    });
    if (!appointment) {
      return { success: false, error: "Appuntamento non trovato." };
    }
    if (template.serviceId && template.serviceId !== appointment.serviceId) {
      return { success: false, error: "Il modello non corrisponde al trattamento dell'appuntamento." };
    }
    appointmentId = appointment.id;
    appointmentStart = appointment.startTime;
    appointmentServiceName = appointment.service.name;
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
  const anamnesis = template.type === "TREATMENT" ? input.anamnesis?.trim() || null : null;
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
      serviceName: appointmentServiceName ?? template.service?.name ?? null,
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
        answers: anamnesis ? { anamnesis } : undefined,
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
      include: { service: { select: { name: true } } },
    }),
    prisma.consentRecord.findMany({
      where: { tenantId, clientId },
      orderBy: { createdAt: "desc" },
      include: { template: { select: { type: true } } },
    }),
    prisma.appointment.findMany({
      where: { tenantId, clientId, status: { not: "CANCELLED" } },
      select: { serviceId: true },
      distinct: ["serviceId"],
    }),
  ]);

  const clientServiceIds = new Set(appointments.map((appointment) => appointment.serviceId));

  const items: ClientConsentItemDTO[] = [];
  for (const template of templates) {
    // Ordinati dal più recente: il primo è l'ultimo stato per quel modello.
    const latest = records.find((record) => record.templateId === template.id);

    // I consensi per trattamento sono rilevanti solo se la cliente ha quel trattamento
    // (o ne ha già firmato uno): altrimenti sarebbero tutti "mancanti".
    if (
      template.type === "TREATMENT" &&
      !latest &&
      !(template.serviceId && clientServiceIds.has(template.serviceId))
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
      serviceName: template.service?.name ?? null,
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
