"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { clientFormSchema, type ClientFormValues } from "./schema";

export type ClientSegment = "all" | "vip" | "new" | "active" | "inactive" | "no_future";

export type ClientDTO = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  isVip: boolean;
  preferredOperatorId: string | null;
  createdAt: Date;
};

export type ClientListItemDTO = ClientDTO & {
  lastAppointment: { date: Date; serviceName: string } | null;
  nextAppointment: { date: Date; serviceName: string } | null;
  visitCount: number;
  totalSpent: number;
  segment: "vip" | "new" | "inactive" | "active";
};

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toClientDTO(client: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  isVip: boolean;
  preferredOperatorId: string | null;
  createdAt: Date;
}): ClientDTO {
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
    isVip: client.isVip,
    preferredOperatorId: client.preferredOperatorId,
    createdAt: client.createdAt,
  };
}

function computeSegment(
  isVip: boolean,
  createdAt: Date,
  lastAppointmentDate: Date | null
): "vip" | "new" | "inactive" | "active" {
  if (isVip) return "vip";
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (createdAt > thirtyDaysAgo) return "new";
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  if (!lastAppointmentDate || lastAppointmentDate < ninetyDaysAgo) return "inactive";
  return "active";
}

export async function getClients(input?: {
  search?: string;
  segment?: ClientSegment;
}): Promise<ClientListItemDTO[]> {
  const { tenantId } = await getTenantContext();
  const search = input?.search?.trim();
  const segment = input?.segment ?? "all";

  const now = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const whereBase = {
    tenantId,
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search } },
      ],
    }),
    ...(segment === "vip" && { isVip: true }),
    ...(segment === "new" && { createdAt: { gte: thirtyDaysAgo } }),
  };

  const clients = await prisma.client.findMany({
    where: whereBase,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      appointments: {
        where: { status: { notIn: ["CANCELLED"] } },
        orderBy: { startTime: "desc" },
        select: {
          startTime: true,
          status: true,
          service: { select: { name: true } },
          payment: { select: { amount: true } },
        },
      },
    },
  });

  const result: ClientListItemDTO[] = clients.map((client) => {
    const pastAppts = client.appointments.filter((a) => a.startTime <= now);
    const futureAppts = client.appointments.filter((a) => a.startTime > now);
    const lastAppt = pastAppts[0] ?? null;
    const nextAppt = futureAppts[futureAppts.length - 1] ?? null;

    const totalSpent = pastAppts
      .filter((a) => a.status === "COMPLETED")
      .reduce((sum, a) => sum + (a.payment?.amount.toNumber() ?? 0), 0);

    const visitCount = pastAppts.filter((a) => a.status === "COMPLETED").length;
    const seg = computeSegment(client.isVip, client.createdAt, lastAppt?.startTime ?? null);

    return {
      ...toClientDTO(client),
      lastAppointment: lastAppt
        ? { date: lastAppt.startTime, serviceName: lastAppt.service.name }
        : null,
      nextAppointment: nextAppt
        ? { date: nextAppt.startTime, serviceName: nextAppt.service.name }
        : null,
      visitCount,
      totalSpent,
      segment: seg,
    };
  });

  if (segment === "inactive") {
    return result.filter((c) => c.segment === "inactive");
  }
  if (segment === "no_future") {
    return result.filter((c) => !c.nextAppointment);
  }

  return result;
}

export async function getClientById(id: string): Promise<ClientDTO | null> {
  const { tenantId } = await getTenantContext();

  const client = await prisma.client.findFirst({
    where: { id, tenantId },
  });

  return client ? toClientDTO(client) : null;
}

export type ClientDetailStats = {
  visitCount: number;
  totalSpent: number;
  lastAppointmentDate: Date | null;
  nextAppointmentDate: Date | null;
  preferredOperator: { firstName: string; lastName: string } | null;
};

export async function getClientDetailStats(clientId: string): Promise<ClientDetailStats> {
  const { tenantId } = await getTenantContext();

  const [appointments, client] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId, clientId, status: { notIn: ["CANCELLED"] } },
      orderBy: { startTime: "desc" },
      select: {
        startTime: true,
        status: true,
        payment: { select: { amount: true } },
      },
    }),
    prisma.client.findFirst({
      where: { id: clientId, tenantId },
      include: {
        appointments: false,
      },
    }),
  ]);

  const now = new Date();
  const past = appointments.filter((a) => a.startTime <= now);
  const future = appointments.filter((a) => a.startTime > now);

  const totalSpent = past
    .filter((a) => a.status === "COMPLETED")
    .reduce((s, a) => s + (a.payment?.amount.toNumber() ?? 0), 0);

  const visitCount = past.filter((a) => a.status === "COMPLETED").length;

  let preferredOperator = null;
  if (client?.preferredOperatorId) {
    const op = await prisma.user.findUnique({
      where: { id: client.preferredOperatorId },
      select: { firstName: true, lastName: true },
    });
    preferredOperator = op;
  }

  return {
    visitCount,
    totalSpent,
    lastAppointmentDate: past[0]?.startTime ?? null,
    nextAppointmentDate: future[future.length - 1]?.startTime ?? null,
    preferredOperator,
  };
}

export type ClientActionResult =
  | { success: true; client: ClientDTO }
  | { success: false; error: string };

export async function createClient(values: ClientFormValues): Promise<ClientActionResult> {
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

export async function updateClient(id: string, values: ClientFormValues): Promise<ClientActionResult> {
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

export async function toggleClientVip(id: string, isVip: boolean): Promise<ClientActionResult> {
  const { tenantId } = await getTenantContext();

  const result = await prisma.client.updateMany({
    where: { id, tenantId },
    data: { isVip },
  });

  if (result.count === 0) {
    return { success: false, error: "Cliente non trovato." };
  }

  const client = await prisma.client.findFirstOrThrow({ where: { id, tenantId } });
  return { success: true, client: toClientDTO(client) };
}
