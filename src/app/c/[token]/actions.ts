"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { generateConsentPdf } from "@/lib/consent-pdf";
import { prisma } from "@/lib/prisma";
import { removeStorageFile, writeStorageFile } from "@/lib/storage";

import { consentTypeLabels, PNG_DATA_URL_PREFIX } from "../../dashboard/consents/schema";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const MAX_SIGNATURE_BYTES = 700_000;

function decodeSignature(dataUrl: string): Buffer | null {
  const buffer = Buffer.from(dataUrl.slice(PNG_DATA_URL_PREFIX.length), "base64");
  if (buffer.length === 0 || buffer.length > MAX_SIGNATURE_BYTES) {
    return null;
  }
  return buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC) ? buffer : null;
}

export type SignConsentFromLinkResult = { success: true } | { success: false; error: string };

export async function signConsentFromLink(
  token: string,
  signatureDataUrl: string
): Promise<SignConsentFromLinkResult> {
  const record = await prisma.consentRecord.findUnique({
    where: { token },
    include: {
      client: true,
      template: { include: { service: { select: { name: true } } } },
      tenant: { select: { name: true } },
    },
  });

  if (!record) {
    return { success: false, error: "Link non valido." };
  }
  if (record.status !== "PENDING") {
    return { success: false, error: "Consenso già firmato." };
  }

  const signature = decodeSignature(signatureDataUrl);
  if (!signature) {
    return { success: false, error: "Firma non valida." };
  }

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = requestHeaders.get("user-agent");

  const signatureKey = `consents/${record.tenantId}/${record.id}/signature.png`;
  const pdfKey = `consents/${record.tenantId}/${record.id}/consent.pdf`;
  const signedAt = new Date();

  try {
    const pdf = await generateConsentPdf({
      recordId: record.id,
      centerName: record.tenant.name,
      typeLabel: consentTypeLabels[record.template.type as keyof typeof consentTypeLabels] ?? record.template.type,
      title: record.titleSnapshot,
      body: record.bodySnapshot,
      version: record.templateVersion,
      client: {
        firstName: record.client.firstName,
        lastName: record.client.lastName,
        phone: record.client.phone,
        email: record.client.email,
        dateOfBirth: record.client.dateOfBirth,
        taxCode: record.client.taxCode,
      },
      serviceName: record.template.service?.name ?? null,
      appointmentStart: null,
      marketingChoice: record.template.type === "MARKETING" ? record.granted : null,
      anamnesis: null,
      signedAt,
      operatorName: null,
      ipAddress,
      signaturePng: signature,
    });

    await writeStorageFile(signatureKey, signature);
    await writeStorageFile(pdfKey, pdf);

    await prisma.consentRecord.update({
      where: { id: record.id },
      data: {
        status: "SIGNED",
        signatureKey,
        pdfKey,
        documentHash: createHash("sha256").update(pdf).digest("hex"),
        ipAddress,
        userAgent,
        signedAt,
      },
    });
  } catch (error) {
    console.error("[consents] failed to store signed consent from link", error);
    await Promise.allSettled([removeStorageFile(signatureKey), removeStorageFile(pdfKey)]);
    return { success: false, error: "Impossibile salvare il consenso. Riprova." };
  }

  return { success: true };
}
