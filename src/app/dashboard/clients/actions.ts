"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { clientFormSchema, type ClientFormValues } from "./schema";

export type ClientDTO = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: Date;
};

export type ClientListItemDTO = ClientDTO & {
  lastAppointment: { date: Date; serviceName: string } | null;
};

function toClientDTO(client: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: Date;
}): ClientDTO {
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
    createdAt: client.createdAt,
  };
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
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

  return clients.map((client) => ({
    ...toClientDTO(client),
    lastAppointment: client.appointments[0]
      ? {
          date: client.appointments[0].startTime,
          serviceName: client.appointments[0].service.name,
        }
      : null,
  }));
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
    },
  });

  if (result.count === 0) {
    return { success: false, error: "Cliente non trovato." };
  }

  const client = await prisma.client.findFirstOrThrow({ where: { id, tenantId } });
  return { success: true, client: toClientDTO(client) };
}
