"use server";

import { after } from "next/server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { stopAppointmentRuns, triggerAppointmentAutomations } from "@/lib/automation-engine";
import { findClash } from "@/lib/availability";
import { cancelPendingProposals } from "@/lib/booking-proposals";

import { appointmentInclude, toAppointmentDTO, type AppointmentDTO } from "./dto";

export type { AppointmentDTO } from "./dto";
import {
  APPOINTMENT_STATUSES,
  appointmentInputSchema,
  type AppointmentInput,
  type AppointmentStatusValue,
} from "./schema";

export type OperatorDTO = {
  id: string;
  firstName: string;
  lastName: string;
  workingHours: { dayOfWeek: number; startTime: string; endTime: string }[];
  /** Trattamenti che l'operatrice non esegue. */
  excludedServiceIds: string[];
};

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

  const operators = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ["ADMIN", "OPERATOR"] } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      workingHours: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
      excludedServices: { select: { id: true } },
    },
  });

  return operators.map(({ excludedServices, ...operator }) => ({
    ...operator,
    excludedServiceIds: excludedServices.map((service) => service.id),
  }));
}

export type AppointmentActionResult =
  | { success: true; appointment: AppointmentDTO }
  /** clash: l'orario si accavalla, la UI può offrire "Salva comunque" (force). */
  | { success: false; error: string; clash?: boolean };

/** Ferma tutto ciò che riguarda il vecchio orario: proposte su WhatsApp in attesa e messaggi automatici programmati. */
async function stopPendingForAppointment(appointmentId: string) {
  await cancelPendingProposals(appointmentId);
  await stopAppointmentRuns(appointmentId);
}

async function resolveOperatorId(
  tenantId: string,
  operatorId: string | null,
  serviceId: string
): Promise<
  { ok: true; operatorId: string | null } | { ok: false; error: string }
> {
  if (!operatorId) {
    return { ok: true, operatorId: null };
  }

  const operator = await prisma.user.findFirst({
    where: { id: operatorId, tenantId, role: { in: ["ADMIN", "OPERATOR"] } },
    include: { excludedServices: { where: { id: serviceId }, select: { id: true } } },
  });

  if (!operator) {
    return { ok: false, error: "Operatore non valido." };
  }
  if (operator.excludedServices.length > 0) {
    return { ok: false, error: `${operator.firstName} non esegue questo trattamento.` };
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

  const operatorResult = await resolveOperatorId(tenantId, parsed.data.operatorId, service.id);
  if (!operatorResult.ok) {
    return { success: false, error: operatorResult.error };
  }

  const endTime = new Date(
    parsed.data.startTime.getTime() + parsed.data.durationMinutes * 60000
  );

  if (!parsed.data.force) {
    const clash = await findClash(tenantId, {
      operatorId: operatorResult.operatorId,
      start: parsed.data.startTime,
      end: endTime,
    });
    if (clash) return { success: false, error: clash, clash: true };
  }

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

  if (appointment.startTime > new Date()) {
    after(() => triggerAppointmentAutomations("APPOINTMENT_CONFIRMED", appointment.id));
  }

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

  const operatorResult = await resolveOperatorId(tenantId, parsed.data.operatorId, service.id);
  if (!operatorResult.ok) {
    return { success: false, error: operatorResult.error };
  }

  const endTime = new Date(
    parsed.data.startTime.getTime() + parsed.data.durationMinutes * 60000
  );

  const previous = await prisma.appointment.findFirst({
    where: { id, tenantId },
    select: { startTime: true, endTime: true, operatorId: true, status: true },
  });
  if (!previous) {
    return { success: false, error: "Appuntamento non trovato." };
  }

  const moved =
    previous.startTime.getTime() !== parsed.data.startTime.getTime() ||
    previous.operatorId !== operatorResult.operatorId;
  const slotChanged = moved || previous.endTime.getTime() !== endTime.getTime();
  const active = previous.status === "BOOKED" || previous.status === "CONFIRMED";

  // Si controlla solo se cambia l'orario: salvare una nota non deve bloccare.
  if (active && slotChanged && !parsed.data.force) {
    const clash = await findClash(tenantId, {
      operatorId: operatorResult.operatorId,
      start: parsed.data.startTime,
      end: endTime,
      excludeAppointmentId: id,
    });
    if (clash) return { success: false, error: clash, clash: true };
  }

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

  // Spostato: le proposte e i promemoria del vecchio orario non valgono più;
  // se era confermato la cliente riceve la conferma col nuovo orario.
  if (moved) {
    await stopPendingForAppointment(id);
    if (appointment.status === "CONFIRMED" && appointment.startTime > new Date()) {
      after(() => triggerAppointmentAutomations("APPOINTMENT_CONFIRMED", appointment.id));
    }
  }

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

  const previous = await prisma.appointment.findFirst({
    where: { id, tenantId },
    select: {
      status: true,
      startTime: true,
      endTime: true,
      operatorId: true,
      payment: { select: { id: true } },
    },
  });
  if (!previous) {
    return { success: false, error: "Appuntamento non trovato." };
  }

  if (previous.status === "COMPLETED" && previous.payment && status !== "COMPLETED") {
    return { success: false, error: "Ha già un pagamento registrato." };
  }
  if (status === "NO_SHOW" && previous.startTime > new Date()) {
    return { success: false, error: "L'appuntamento non è ancora iniziato." };
  }
  // Riattivare un appuntamento annullato: l'orario potrebbe essere stato preso nel frattempo.
  const wasInactive = previous.status === "CANCELLED" || previous.status === "NO_SHOW";
  if (wasInactive && (status === "CONFIRMED" || status === "BOOKED")) {
    const clash = await findClash(tenantId, {
      operatorId: previous.operatorId,
      start: previous.startTime,
      end: previous.endTime,
      excludeAppointmentId: id,
    });
    if (clash) return { success: false, error: `${clash} Sposta l'appuntamento su un altro orario.` };
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

  if ((status === "CANCELLED" || status === "NO_SHOW") && previous.status !== status) {
    await stopPendingForAppointment(id);
  }

  // Conferma di una richiesta online: la cliente riceve la conferma su WhatsApp.
  if (status === "CONFIRMED" && previous.status !== "CONFIRMED" && appointment.startTime > new Date()) {
    after(() => triggerAppointmentAutomations("APPOINTMENT_CONFIRMED", appointment.id));
  }

  return { success: true, appointment: toAppointmentDTO(appointment) };
}
