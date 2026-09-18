"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import type { ConsentStatusValue, ConsentTypeValue } from "./constants";

export type { ConsentTypeValue, ConsentStatusValue };

export type ConsentDTO = {
  id: string;
  clientId: string;
  type: ConsentTypeValue;
  status: ConsentStatusValue;
  signedAt: Date | null;
  content: string | null;
};

export type ConsentActionResult =
  | { success: true; consent: ConsentDTO }
  | { success: false; error: string };

function toConsentDTO(c: {
  id: string;
  clientId: string;
  type: ConsentTypeValue;
  status: ConsentStatusValue;
  signedAt: Date | null;
  content: string | null;
}): ConsentDTO {
  return { ...c };
}

export async function getConsentsByClient(clientId: string): Promise<ConsentDTO[]> {
  const { tenantId } = await getTenantContext();

  const consents = await prisma.consent.findMany({
    where: { tenantId, clientId },
    orderBy: { type: "asc" },
  });

  return consents.map(toConsentDTO);
}

export async function upsertConsent(input: {
  clientId: string;
  type: ConsentTypeValue;
  status: ConsentStatusValue;
}): Promise<ConsentActionResult> {
  const { tenantId } = await getTenantContext();

  const client = await prisma.client.findFirst({ where: { id: input.clientId, tenantId } });
  if (!client) return { success: false, error: "Cliente non trovato." };

  const consent = await prisma.consent.upsert({
    where: { clientId_type: { clientId: input.clientId, type: input.type } },
    update: {
      status: input.status,
      signedAt: input.status === "GIVEN" ? new Date() : null,
    },
    create: {
      tenantId,
      clientId: input.clientId,
      type: input.type,
      status: input.status,
      signedAt: input.status === "GIVEN" ? new Date() : null,
      content: getDefaultConsentContent(input.type),
    },
  });

  return { success: true, consent: toConsentDTO(consent) };
}

export async function getClientConsentSummary(clientId: string): Promise<{
  total: number;
  given: number;
  missing: number;
  isComplete: boolean;
}> {
  const { tenantId } = await getTenantContext();
  const consents = await prisma.consent.findMany({ where: { tenantId, clientId } });
  const allTypes: ConsentTypeValue[] = ["PRIVACY", "MARKETING", "DATA_PROCESSING", "TREATMENT_SPECIFIC"];
  const given = consents.filter((c) => c.status === "GIVEN").length;
  const missing = allTypes.length - consents.filter((c) => c.status !== "PENDING").length;

  return {
    total: allTypes.length,
    given,
    missing,
    isComplete: missing === 0 && given >= 2,
  };
}

function getDefaultConsentContent(type: ConsentTypeValue): string {
  switch (type) {
    case "PRIVACY":
      return "Consenso al trattamento dei dati personali ai sensi del Reg. UE 2016/679 (GDPR).";
    case "MARKETING":
      return "Consenso all'invio di comunicazioni commerciali, promozionali e newsletter.";
    case "DATA_PROCESSING":
      return "Consenso al trattamento dei dati per finalità operative e di gestione del rapporto con il centro.";
    case "TREATMENT_SPECIFIC":
      return "Liberatoria per il trattamento estetico. La cliente dichiara di essere stata informata su procedure, rischi e controindicazioni.";
  }
}
