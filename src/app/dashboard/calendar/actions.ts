"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import {
  APPOINTMENT_STATUSES,
  appointmentInputSchema,
  type AppointmentInput,
  type AppointmentStatusValue,
} from "./schema";

export type AppointmentDTO = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatusValue;
  notes: string | null;
  client: { id: string; firstName: string; lastName: string };
  service: { id: string; name: string; durationMinutes: number };
  operator: { id: string; firstName: string; lastName: string } | null;
};

export type OperatorDTO = {
  id: string;
  firstName: string;
  lastName: string;
};

const appointmentInclude = {
  client: { select: { id: true, firstName: true, lastName: true } },
  service: { select: { id: true, name: true, durationMinutes: true } },
  operator: { select: { id: true, firstName: true, lastName: true } },
} as const;

function toAppointmentDTO(appointment: {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatusValue;
  notes: string | null;
  client: { id: string; firstName: string; lastName: string };
  service: { id: string; name: string; durationMinutes: number };
  operator: { id: string; firstName: string; lastName: string } | null;
}): AppointmentDTO {
  return { ...appointment };
}

export async function getAppointments(input: {
  start: Date;
  end: Date;
}): Promise<AppointmentDTO[]> {
  const { tenantId } = await getTenantContext();

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      startTime: { gte: input.start, lte: input.end },
    },
    orderBy: { startTime: "asc" },
    include: appointmentInclude,
  });

  return appointments.map(toAppointmentDTO);
}

export async function getOperators(): Promise<OperatorDTO[]> {
  const { tenantId } = await getTenantContext();

  return prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ["ADMIN", "OPERATOR"] } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
}

export type AppointmentActionResult =
  | { success: true; appointment: AppointmentDTO }
  | { success: false; error: string };

async function resolveOperatorId(
  tenantId: string,
  operatorId: string | null
): Promise<
  { ok: true; operatorId: string | null } | { ok: false; error: string }
> {
  if (!operatorId) {
    return { ok: true, operatorId: null };
  }

  const operator = await prisma.user.findFirst({
    where: { id: operatorId, tenantId, role: { in: ["ADMIN", "OPERATOR"] } },
  });

  if (!operator) {
    return { ok: false, error: "Operatore non valido." };
  }

  return { ok: true, operatorId: operator.id };
}

export async function createAppointment(
  values: AppointmentInput
): Promise<AppointmentActionResult> {
  const { tenantId } = await getTenantContext();

  const parsed = appointmentInputSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, tenantId },
  });
  if (!client) {
    return { success: false, error: "Cliente non trovato." };
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, tenantId },
  });
  if (!service) {
    return { success: false, error: "Trattamento non trovato." };
  }

  const operatorResult = await resolveOperatorId(tenantId, parsed.data.operatorId);
  if (!operatorResult.ok) {
    return { success: false, error: operatorResult.error };
  }

  const endTime = new Date(
    parsed.data.startTime.getTime() + parsed.data.durationMinutes * 60000
  );

  const appointment = await prisma.appointment.create({
    data: {
      tenantId,
      clientId: client.id,
      serviceId: service.id,
      operatorId: operatorResult.operatorId,
      startTime: parsed.data.startTime,
      endTime,
      notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
    },
    include: appointmentInclude,
  });

  return { success: true, appointment: toAppointmentDTO(appointment) };
}

export async function updateAppointment(
  id: string,
  values: AppointmentInput
): Promise<AppointmentActionResult> {
  const { tenantId } = await getTenantContext();

  const parsed = appointmentInputSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, tenantId },
  });
  if (!client) {
    return { success: false, error: "Cliente non trovato." };
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, tenantId },
  });
  if (!service) {
    return { success: false, error: "Trattamento non trovato." };
  }

  const operatorResult = await resolveOperatorId(tenantId, parsed.data.operatorId);
  if (!operatorResult.ok) {
    return { success: false, error: operatorResult.error };
  }

  const endTime = new Date(
    parsed.data.startTime.getTime() + parsed.data.durationMinutes * 60000
  );

  const result = await prisma.appointment.updateMany({
    where: { id, tenantId },
    data: {
      clientId: client.id,
      serviceId: service.id,
      operatorId: operatorResult.operatorId,
      startTime: parsed.data.startTime,
      endTime,
      notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
    },
  });

  if (result.count === 0) {
    return { success: false, error: "Appuntamento non trovato." };
  }

  const appointment = await prisma.appointment.findFirstOrThrow({
    where: { id, tenantId },
    include: appointmentInclude,
  });

  return { success: true, appointment: toAppointmentDTO(appointment) };
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatusValue
): Promise<AppointmentActionResult> {
  const { tenantId } = await getTenantContext();

  if (!APPOINTMENT_STATUSES.includes(status)) {
    return { success: false, error: "Stato non valido." };
  }

  const result = await prisma.appointment.updateMany({
    where: { id, tenantId },
    data: { status },
  });

  if (result.count === 0) {
    return { success: false, error: "Appuntamento non trovato." };
  }

  const appointment = await prisma.appointment.findFirstOrThrow({
    where: { id, tenantId },
    include: appointmentInclude,
  });

  return { success: true, appointment: toAppointmentDTO(appointment) };
}
