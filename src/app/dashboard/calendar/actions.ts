"use server";

import { after } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { stopAppointmentRuns, triggerAppointmentAutomations } from "@/lib/automation-engine";
import { appointmentParts, operatorBlocks, type TreatmentPart } from "@/lib/appointment-services";
import { findClashForParts } from "@/lib/availability";
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

type ServiceRow = { id: string; name: string; price: Prisma.Decimal; durationMinutes: number };
/** Un trattamento dell'appuntamento con chi lo fa e, se sono più di uno, il suo orario. */
type Treatment = { service: ServiceRow; operatorId: string | null; startTime: Date | null };

/**
 * I trattamenti scelti, nell'ordine scelto, ognuno con la sua operatrice: tutti del
 * centro, e ogni operatrice deve eseguire il suo trattamento.
 */
async function loadTreatments(
  tenantId: string,
  input: AppointmentInput["services"]
): Promise<{ ok: true; treatments: Treatment[] } | { ok: false; error: string }> {
  const chosen = input.filter((item, index) => input.findIndex((other) => other.serviceId === item.serviceId) === index);
  const [services, operators] = await Promise.all([
    prisma.service.findMany({ where: { tenantId, id: { in: chosen.map((item) => item.serviceId) } } }),
    prisma.user.findMany({
      where: { tenantId, isActive: true, role: { in: ["ADMIN", "OPERATOR"] } },
      select: { id: true, firstName: true, excludedServices: { select: { id: true } } },
    }),
  ]);

  const treatments: Treatment[] = [];
  for (const item of chosen) {
    const service = services.find((candidate) => candidate.id === item.serviceId);
    if (!service) return { ok: false, error: "Trattamento non trovato." };
    // Ogni trattamento va nell'agenda di un'operatrice (se il centro ne ha).
    if (!item.operatorId) {
      if (operators.length > 0) {
        return { ok: false, error: chosen.length > 1 ? `Scegli l'operatrice per ${service.name}.` : "Scegli l'operatrice." };
      }
      treatments.push({ service, operatorId: null, startTime: item.startTime ?? null });
      continue;
    }
    // Chi non è più attiva resta solo se era già l'operatrice di un vecchio appuntamento.
    const operator =
      operators.find((candidate) => candidate.id === item.operatorId) ??
      (await prisma.user.findFirst({
        where: { id: item.operatorId, tenantId, role: { in: ["ADMIN", "OPERATOR"] } },
        select: { id: true, firstName: true, excludedServices: { select: { id: true } } },
      }));
    if (!operator) return { ok: false, error: "Operatore non valido." };
    if (operator.excludedServices.some((excluded) => excluded.id === service.id)) {
      return { ok: false, error: `${operator.firstName} non esegue ${service.name}.` };
    }
    treatments.push({ service, operatorId: operator.id, startTime: item.startTime ?? null });
  }
  // Più trattamenti: ognuno ha il suo orario, scelto a mano; il primo è quello che inizia prima.
  if (treatments.length > 1) {
    const missing = treatments.find((treatment) => !treatment.startTime);
    if (missing) return { ok: false, error: `Scegli l'orario di ${missing.service.name}.` };
    treatments.sort((a, b) => a.startTime!.getTime() - b.startTime!.getTime());
  }
  return { ok: true, treatments };
}

/**
 * Trattamenti dopo il primo: si salvano con prezzo e durata di adesso; in una modifica
 * quelli che c'erano già tengono prezzo e durata della prenotazione. L'operatrice si
 * salva solo se è diversa da quella dell'appuntamento (quella del primo trattamento).
 */
function extraServicesData(
  treatments: Treatment[],
  previous: { serviceId: string; price: Prisma.Decimal; durationMinutes: number }[] = []
) {
  return treatments.slice(1).map(({ service, operatorId, startTime }, index) => {
    const kept = previous.find((extra) => extra.serviceId === service.id);
    return {
      serviceId: service.id,
      position: index + 1,
      price: kept?.price ?? service.price,
      durationMinutes: kept?.durationMinutes ?? service.durationMinutes,
      operatorId: operatorId === treatments[0].operatorId ? null : operatorId,
      startTime,
    };
  });
}

/** Chi fa cosa, per il controllo degli accavallamenti (durate come verranno salvate). */
function treatmentParts(treatments: Treatment[], extras: { durationMinutes: number }[]): TreatmentPart[] {
  return treatments.map(({ service, operatorId, startTime }, index) => ({
    name: service.name,
    durationMinutes: index === 0 ? service.durationMinutes : extras[index - 1].durationMinutes,
    operatorId,
    startTime: index === 0 ? null : startTime,
  }));
}

/**
 * Inizio e fine dell'appuntamento. Un trattamento: l'orario e la durata scelti. Più
 * trattamenti: dal primo orario alla fine dell'ultimo (è l'inizio che legge la cliente).
 */
function appointmentSlot(input: { startTime: Date; durationMinutes: number }, treatments: Treatment[], parts: TreatmentPart[]) {
  if (treatments.length === 1) {
    return { startTime: input.startTime, endTime: new Date(input.startTime.getTime() + input.durationMinutes * 60000) };
  }
  const startTime = treatments[0].startTime!;
  const ends = parts.map((part, index) => (index === 0 ? startTime : part.startTime!).getTime() + part.durationMinutes * 60000);
  return { startTime, endTime: new Date(Math.max(...ends)) };
}

/** Chi è occupata e quando: se non cambia, non serve ricontrollare l'agenda. */
function blocksKey(start: Date, end: Date, parts: TreatmentPart[]) {
  return operatorBlocks(start, end, parts)
    .map((block) => `${block.operatorId}|${block.startTime.getTime()}|${block.endTime.getTime()}`)
    .join(",");
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

  const loaded = await loadTreatments(tenantId, parsed.data.services);
  if (!loaded.ok) {
    return { success: false, error: loaded.error };
  }
  const { treatments } = loaded;
  const service = treatments[0].service;
  const serviceIds = treatments.map((item) => item.service.id);
  const extras = extraServicesData(treatments);
  const parts = treatmentParts(treatments, extras);
  const { startTime, endTime } = appointmentSlot(parsed.data, treatments, parts);

  if (!parsed.data.force) {
    const clash = await findClashForParts(tenantId, {
      start: startTime,
      end: endTime,
      parts,
    });
    if (clash) return { success: false, error: clash, clash: true };
  }

  const appointment = await prisma.appointment.create({
    data: {
      tenantId,
      clientId: client.id,
      serviceId: service.id,
      operatorId: treatments[0].operatorId,
      startTime,
      endTime,
      notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      extraServices: { create: extras },
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

  const loaded = await loadTreatments(tenantId, parsed.data.services);
  if (!loaded.ok) {
    return { success: false, error: loaded.error };
  }
  const { treatments } = loaded;
  const service = treatments[0].service;
  const serviceIds = treatments.map((item) => item.service.id);

  const previous = await prisma.appointment.findFirst({
    where: { id, tenantId },
    select: {
      startTime: true,
      endTime: true,
      operatorId: true,
      status: true,
      service: { select: { name: true, durationMinutes: true } },
      extraServices: {
        orderBy: { position: "asc" },
        select: { serviceId: true, price: true, durationMinutes: true, operatorId: true, startTime: true },
      },
    },
  });
  if (!previous) {
    return { success: false, error: "Appuntamento non trovato." };
  }
  const extras = extraServicesData(treatments, previous.extraServices);
  const parts = treatmentParts(treatments, extras);
  const { startTime, endTime } = appointmentSlot(parsed.data, treatments, parts);

  // Per la cliente conta solo l'orario: cambiare operatrice non le manda niente
  // e non tocca promemoria e conferme già programmati.
  // Con più trattamenti conta l'inizio del primo: spostare solo gli altri non le manda niente.
  const moved = previous.startTime.getTime() !== startTime.getTime();
  const slotChanged =
    blocksKey(previous.startTime, previous.endTime, appointmentParts(previous)) !== blocksKey(startTime, endTime, parts);
  const active = previous.status === "BOOKED" || previous.status === "CONFIRMED";

  // Si controlla solo se cambia l'orario: salvare una nota non deve bloccare.
  if (active && slotChanged && !parsed.data.force) {
    const clash = await findClashForParts(tenantId, {
      start: startTime,
      end: endTime,
      parts,
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
        operatorId: treatments[0].operatorId,
        startTime,
        endTime,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      },
    }),
    prisma.appointmentExtraService.deleteMany({ where: { appointmentId: id, appointment: { tenantId } } }),
    prisma.appointmentExtraService.createMany({
      data: extras.map((extra) => ({ ...extra, appointmentId: id })),
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
      service: { select: { durationMinutes: true } },
      extraServices: { orderBy: { position: "asc" }, select: { durationMinutes: true, operatorId: true, startTime: true } },
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
    const clash = await findClashForParts(tenantId, {
      start: previous.startTime,
      end: previous.endTime,
      parts: appointmentParts(previous),
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
