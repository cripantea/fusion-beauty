"use server";

import { getBaseUrl } from "@/lib/app-url";
import { getTenantContext } from "@/lib/auth-context";
import { whatsappUrl } from "@/lib/format";
import { emptyStats, getClientStatsMap, INACTIVE_MONTHS, monthsAgoDate } from "@/lib/insights";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

import {
  clientFormSchema,
  quickClientSchema,
  type ClientFormValues,
  type QuickClientValues,
} from "./schema";

export type ClientDTO = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  /** "yyyy-MM-dd" (colonna DATE: nessun fuso orario). */
  dateOfBirth: string | null;
  taxCode: string | null;
  city: string | null;
  allergies: string | null;
  healthNotes: string | null;
  acquisitionSource: string | null;
  interests: string[];
  createdAt: Date;
};

export type ClientListItemDTO = ClientDTO & {
  lastAppointment: { date: Date; serviceName: string } | null;
  visits: number;
  totalSpent: number;
  /** Ultimo trattamento completato. */
  lastVisit: Date | null;
  /** Nessuna visita da oltre 6 mesi e nessun appuntamento futuro. */
  isInactive: boolean;
};

function toClientDTO(client: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  dateOfBirth: Date | null;
  taxCode: string | null;
  city: string | null;
  allergies: string | null;
  healthNotes: string | null;
  acquisitionSource: string | null;
  interests: string[];
  createdAt: Date;
}): ClientDTO {
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
    dateOfBirth: client.dateOfBirth ? client.dateOfBirth.toISOString().slice(0, 10) : null,
    taxCode: client.taxCode,
    city: client.city,
    allergies: client.allergies,
    healthNotes: client.healthNotes,
    acquisitionSource: client.acquisitionSource,
    interests: client.interests,
    createdAt: client.createdAt,
  };
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseDateOfBirth(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function normalizeTaxCode(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

export async function getClients(input?: {
  search?: string;
}): Promise<ClientListItemDTO[]> {
  const { tenantId } = await getTenantContext();
  const search = input?.search?.trim();

  const clients = await prisma.client.findMany({
    where: {
      tenantId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
        ],
      }),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      appointments: {
        orderBy: { startTime: "desc" },
        take: 1,
        select: { startTime: true, service: { select: { name: true } } },
      },
    },
  });

  const [stats, upcoming] = await Promise.all([
    getClientStatsMap(tenantId),
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: new Date() },
        status: { in: ["BOOKED", "CONFIRMED"] },
      },
      select: { clientId: true },
      distinct: ["clientId"],
    }),
  ]);
  const withUpcoming = new Set(upcoming.map((appointment) => appointment.clientId));
  const cutoff = monthsAgoDate(INACTIVE_MONTHS);

  return clients.map((client) => {
    const clientStats = stats.get(client.id) ?? emptyStats();
    return {
      ...toClientDTO(client),
      lastAppointment: client.appointments[0]
        ? {
            date: client.appointments[0].startTime,
            serviceName: client.appointments[0].service.name,
          }
        : null,
      visits: clientStats.visits,
      totalSpent: clientStats.totalSpent,
      lastVisit: clientStats.lastVisit,
      isInactive:
        clientStats.lastVisit !== null &&
        clientStats.lastVisit < cutoff &&
        !withUpcoming.has(client.id),
    };
  });
}

export async function getClientById(id: string): Promise<ClientDTO | null> {
  const { tenantId } = await getTenantContext();

  const client = await prisma.client.findFirst({
    where: { id, tenantId },
  });

  return client ? toClientDTO(client) : null;
}

export type ClientActionResult =
  | { success: true; client: ClientDTO }
  | { success: false; error: string };

export async function createClient(
  values: ClientFormValues
): Promise<ClientActionResult> {
  const { tenantId } = await getTenantContext();

  const parsed = clientFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const client = await prisma.client.create({
    data: {
      tenantId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      email: normalizeOptional(parsed.data.email),
      notes: normalizeOptional(parsed.data.notes),
      dateOfBirth: parseDateOfBirth(parsed.data.dateOfBirth),
      taxCode: normalizeTaxCode(parsed.data.taxCode),
      city: normalizeOptional(parsed.data.city),
      allergies: normalizeOptional(parsed.data.allergies),
      healthNotes: normalizeOptional(parsed.data.healthNotes),
    },
  });

  return { success: true, client: toClientDTO(client) };
}

export async function updateClient(
  id: string,
  values: ClientFormValues
): Promise<ClientActionResult> {
  const { tenantId } = await getTenantContext();

  const parsed = clientFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const result = await prisma.client.updateMany({
    where: { id, tenantId },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      email: normalizeOptional(parsed.data.email),
      notes: normalizeOptional(parsed.data.notes),
      dateOfBirth: parseDateOfBirth(parsed.data.dateOfBirth),
      taxCode: normalizeTaxCode(parsed.data.taxCode),
      city: normalizeOptional(parsed.data.city),
      allergies: normalizeOptional(parsed.data.allergies),
      healthNotes: normalizeOptional(parsed.data.healthNotes),
    },
  });

  if (result.count === 0) {
    return { success: false, error: "Cliente non trovato." };
  }

  const client = await prisma.client.findFirstOrThrow({ where: { id, tenantId } });
  return { success: true, client: toClientDTO(client) };
}

export type QuestionnaireLink = {
  url: string;
  whatsappUrl: string;
};

async function buildQuestionnaireLink(
  tenantId: string,
  client: { id: string; firstName: string; phone: string }
): Promise<QuestionnaireLink> {
  const [tenant, baseUrl] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
    getBaseUrl(),
  ]);

  const token = randomBytes(24).toString("base64url");
  await prisma.clientQuestionnaire.create({
    data: { tenantId, clientId: client.id, token, sentAt: new Date() },
  });

  const url = `${baseUrl}/q/${token}`;
  const message =
    `Ciao ${client.firstName} 😊 Benvenuta da ${tenant.name}! ` +
    `Per prepararci al meglio al tuo arrivo, ti chiediamo un minuto per compilare questo breve questionario: ${url}`;

  return { url, whatsappUrl: whatsappUrl(client.phone, message) };
}

export type QuickClientResult =
  | { success: true; client: ClientDTO; questionnaire: QuestionnaireLink }
  | { success: false; error: string };

/** Crea la cliente con solo nome, cognome e telefono e prepara il link WhatsApp del questionario. */
export async function createQuickClient(values: QuickClientValues): Promise<QuickClientResult> {
  const { tenantId } = await getTenantContext();

  const parsed = quickClientSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla nome, cognome e telefono." };
  }

  const client = await prisma.client.create({
    data: {
      tenantId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
    },
  });

  const questionnaire = await buildQuestionnaireLink(tenantId, client);
  return { success: true, client: toClientDTO(client), questionnaire };
}

export async function createQuestionnaireLink(
  clientId: string
): Promise<{ success: true; questionnaire: QuestionnaireLink } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    select: { id: true, firstName: true, phone: true },
  });
  if (!client) {
    return { success: false, error: "Cliente non trovata." };
  }

  return { success: true, questionnaire: await buildQuestionnaireLink(tenantId, client) };
}
