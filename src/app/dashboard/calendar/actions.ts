"use server";

import { after } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { stopAppointmentRuns, triggerAppointmentAutomations } from "@/lib/automation-engine";
import { findClash } from "@/lib/availability";
import { cancelPendingProposals } from "@/lib/booking-proposals";
import { findAppointmentsMissingConsent, prepareConsentLinks } from "@/lib/consents";

import { appointmentInclude, toAppointmentDTO, type AppointmentDTO, type AppointmentRow } from "./dto";

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

  const missingConsent = await findAppointmentsMissingConsent(tenantId, appointments);
  return appointments.map((appointment) => ({
    ...toAppointmentDTO(appointment),
    consentMissing: missingConsent.has(appointment.id),
  }));
}

/** DTO con l'avviso "Consenso" dell'agenda (trattamento che richiede un consenso non firmato). */
async function withConsentFlag(tenantId: string, appointment: AppointmentRow): Promise<AppointmentDTO> {
  const missing = await findAppointmentsMissingConsent(tenantId, [appointment]);
  return { ...toAppointmentDTO(appointment), consentMissing: missing.has(appointment.id) };
}

export async function getOperators(): Promise<OperatorDTO[]> {
  const { tenantId } = await getTenantContext();

  const operators = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ["ADMIN", "OPERATOR"] } },
    orderBy: [{ agendaOrder: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
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

/** I trattamenti scelti, nell'ordine scelto (il primo è il principale), tutti del centro. */
async function loadServices(tenantId: string, serviceIds: string[]) {
  const ids = [...new Set(serviceIds)];
  const found = await prisma.service.findMany({ where: { tenantId, id: { in: ids } } });
  const services = ids.map((id) => found.find((service) => service.id === id));
  return services.every((service) => service !== undefined) ? services : null;
}

/**
 * Trattamenti dopo il primo: si salvano con prezzo e durata di adesso; in una modifica
 * quelli che c'erano già tengono prezzo e durata della prenotazione.
 */
function extraServicesData(
  services: { id: string; price: Prisma.Decimal; durationMinutes: number }[],
  previous: { serviceId: string; price: Prisma.Decimal; durationMinutes: number }[] = []
) {
  return services.slice(1).map((service, index) => {
    const kept = previous.find((extra) => extra.serviceId === service.id);
    return {
      serviceId: service.id,
      position: index + 1,
      price: kept?.price ?? service.price,
      durationMinutes: kept?.durationMinutes ?? service.durationMinutes,
    };
  });
}

async function resolveOperatorId(
  tenantId: string,
  operatorId: string | null,
  serviceIds: string[]
): Promise<
  { ok: true; operatorId: string | null } | { ok: false; error: string }
> {
  // Ogni appuntamento va nell'agenda di un'operatrice (se il centro ne ha).
  if (!operatorId) {
    const hasOperators = await prisma.user.count({ where: { tenantId, isActive: true, role: { in: ["ADMIN", "OPERATOR"] } } });
    return hasOperators > 0 ? { ok: false, error: "Scegli l'operatrice." } : { ok: true, operatorId: null };
  }

  const operator = await prisma.user.findFirst({
    where: { id: operatorId, tenantId, role: { in: ["ADMIN", "OPERATOR"] } },
    include: { excludedServices: { where: { id: { in: serviceIds } }, select: { id: true, name: true } } },
  });

  if (!operator) {
    return { ok: false, error: "Operatore non valido." };
  }
  // Deve saper fare tutti i trattamenti dell'appuntamento.
  if (operator.excludedServices.length > 0) {
    const names = operator.excludedServices.map((service) => service.name).join(" e ");
    return { ok: false, error: `${operator.firstName} non esegue ${names}.` };
  }

  return { ok: true, operatorId: operator.id };
}

/** Alla cliente è già arrivata la conferma: appuntamento confermato o preso dall'agenda (la conferma parte alla creazione). */
function confirmationSentFor(appointment: { status: string; source: string }) {
  return appointment.status === "CONFIRMED" || (appointment.status === "BOOKED" && appointment.source === "INTERNAL");
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

  const services = await loadServices(tenantId, parsed.data.serviceIds);
  if (!services) {
    return { success: false, error: "Trattamento non trovato." };
  }
  const service = services[0];
  const serviceIds = services.map((item) => item.id);

  const operatorResult = await resolveOperatorId(tenantId, parsed.data.operatorId, serviceIds);
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
      extraServices: { create: extraServicesData(services) },
    },
    include: appointmentInclude,
  });

  if (appointment.startTime > new Date()) {
    after(() => triggerAppointmentAutomations("APPOINTMENT_CONFIRMED", appointment.id));
  }
  // Trattamento con consenso (es. laser) non ancora firmato: il link è già pronto da mandare.
  after(() => prepareConsentLinks(tenantId, client.id, serviceIds));

  return { success: true, appointment: await withConsentFlag(tenantId, appointment) };
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

  const services = await loadServices(tenantId, parsed.data.serviceIds);
  if (!services) {
    return { success: false, error: "Trattamento non trovato." };
  }
  const service = services[0];
  const serviceIds = services.map((item) => item.id);

  const operatorResult = await resolveOperatorId(tenantId, parsed.data.operatorId, serviceIds);
  if (!operatorResult.ok) {
    return { success: false, error: operatorResult.error };
  }

  const endTime = new Date(
    parsed.data.startTime.getTime() + parsed.data.durationMinutes * 60000
  );

  const previous = await prisma.appointment.findFirst({
    where: { id, tenantId },
    select: {
      startTime: true,
      endTime: true,
      operatorId: true,
      status: true,
      extraServices: { select: { serviceId: true, price: true, durationMinutes: true } },
    },
  });
  if (!previous) {
    return { success: false, error: "Appuntamento non trovato." };
  }

  // Per la cliente conta solo l'orario: cambiare operatrice non le manda niente
  // e non tocca promemoria e conferme già programmati.
  const moved = previous.startTime.getTime() !== parsed.data.startTime.getTime();
  const slotChanged =
    moved || previous.operatorId !== operatorResult.operatorId || previous.endTime.getTime() !== endTime.getTime();
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

  // Appuntamento e lista dei trattamenti cambiano insieme (gli altri trattamenti si riscrivono da capo).
  const [result] = await prisma.$transaction([
    prisma.appointment.updateMany({
      where: { id, tenantId },
      data: {
        clientId: client.id,
        serviceId: service.id,
        operatorId: operatorResult.operatorId,
        startTime: parsed.data.startTime,
        endTime,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      },
    }),
    prisma.appointmentExtraService.deleteMany({ where: { appointmentId: id, appointment: { tenantId } } }),
    prisma.appointmentExtraService.createMany({
      data: extraServicesData(services, previous.extraServices).map((extra) => ({ ...extra, appointmentId: id })),
    }),
  ]);

  if (result.count === 0) {
    return { success: false, error: "Appuntamento non trovato." };
  }

  const appointment = await prisma.appointment.findFirstOrThrow({
    where: { id, tenantId },
    include: appointmentInclude,
  });

  // Cambiato trattamento con consenso (es. laser): il link è già pronto da mandare.
  after(() => prepareConsentLinks(tenantId, client.id, serviceIds));

  // Spostato: le proposte e i promemoria del vecchio orario non valgono più;
  // se era confermato la cliente riceve la conferma col nuovo orario.
  if (moved) {
    await stopPendingForAppointment(id);
    // La conferma l'ha già avuta (confermato, o preso dall'agenda): riceve quella col nuovo orario.
    if (confirmationSentFor(appointment) && appointment.startTime > new Date()) {
      after(() => triggerAppointmentAutomations("APPOINTMENT_CONFIRMED", appointment.id));
    }
  }

  return { success: true, appointment: await withConsentFlag(tenantId, appointment) };
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

  // Confermato all'orario attuale: una proposta di altro orario ancora aperta non vale più.
  if (status === "CONFIRMED" && previous.status !== "CONFIRMED") {
    await cancelPendingProposals(id);
  }

  // Conferma di una richiesta online: la cliente riceve la conferma su WhatsApp.
  if (status === "CONFIRMED" && previous.status !== "CONFIRMED" && appointment.startTime > new Date()) {
    after(() => triggerAppointmentAutomations("APPOINTMENT_CONFIRMED", appointment.id));
  }

  return { success: true, appointment: toAppointmentDTO(appointment) };
}
