"use server";

import { after } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { triggerAppointmentAutomations, triggerClientCreated } from "@/lib/automation-engine";
import { closeSupersededRequests } from "@/lib/booking-proposals";

import { createBookingSchema, getSlotsSchema } from "./schema";

// Senza orari di lavoro impostati per lo staff: lun–sab 8–19.
const DEFAULT_HOURS = { start: "08:00", end: "19:00", days: [1, 2, 3, 4, 5, 6] };
const SLOT_STEP_MINUTES = 30;
const TIME_ZONE = "Europe/Rome";

/** Istante di "giorno alle hh:mm" nell'ora italiana, qualunque sia il fuso del server. */
function romeTime(day: string, hhmm: string): Date {
  const guess = new Date(`${day}T${hhmm}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asRome = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asRome - guess.getTime()));
}

/** "YYYY-MM-DD" del giorno italiano di un istante. */
function romeDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

/**
 * Fasce in cui il centro lavora quel giorno: l'unione degli orari delle
 * operatrici (con le eccezioni del giorno: senza orari = assente).
 */
async function openIntervals(tenantId: string, day: string): Promise<{ start: Date; end: Date }[]> {
  const dow = ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1=lun … 7=dom
  const anyHours = await prisma.workingHours.count({ where: { tenantId, isActive: true } });
  if (anyHours === 0) {
    return DEFAULT_HOURS.days.includes(dow)
      ? [{ start: romeTime(day, DEFAULT_HOURS.start), end: romeTime(day, DEFAULT_HOURS.end) }]
      : [];
  }
  const [hours, exceptions] = await Promise.all([
    prisma.workingHours.findMany({
      where: { tenantId, isActive: true, dayOfWeek: dow, user: { isActive: true } },
      select: { userId: true, startTime: true, endTime: true },
    }),
    prisma.staffException.findMany({
      where: { tenantId, date: new Date(`${day}T00:00:00Z`) },
      select: { userId: true, startTime: true, endTime: true },
    }),
  ]);
  const exceptionUsers = new Set(exceptions.map((e) => e.userId));
  const ranges = [
    ...hours.filter((h) => !exceptionUsers.has(h.userId)),
    ...exceptions.filter((e): e is typeof e & { startTime: string; endTime: string } => Boolean(e.startTime && e.endTime)),
  ];
  return ranges.map((r) => ({ start: romeTime(day, r.startTime), end: romeTime(day, r.endTime) }));
}

async function findActiveTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  return tenant && tenant.isActive ? tenant : null;
}

async function findBookableService(tenantId: string, serviceId: string) {
  return prisma.service.findFirst({
    where: { id: serviceId, tenantId, isActive: true, isOnlineBookingEnabled: true },
  });
}

async function computeAvailableSlots(tenantId: string, day: string, durationMinutes: number): Promise<Date[]> {
  const intervals = await openIntervals(tenantId, day);
  if (intervals.length === 0) return [];
  const dayStart = new Date(Math.min(...intervals.map((i) => i.start.getTime())));
  const dayEnd = new Date(Math.max(...intervals.map((i) => i.end.getTime())));

  const [existingAppointments, externalEvents] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId,
        status: { not: "CANCELLED" },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      select: { startTime: true, endTime: true },
    }),
    prisma.externalCalendarEvent.findMany({
      where: {
        tenantId,
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const busyIntervals = [...existingAppointments, ...externalEvents];

  const now = Date.now();
  const durationMs = durationMinutes * 60000;
  const stepMs = SLOT_STEP_MINUTES * 60000;
  const slots: Date[] = [];

  for (let candidateStart = dayStart.getTime(); candidateStart + durationMs <= dayEnd.getTime(); candidateStart += stepMs) {
    if (candidateStart < now) continue;
    const candidateEnd = candidateStart + durationMs;
    // Tutto il trattamento dentro una fascia di lavoro…
    const insideHours = intervals.some((i) => i.start.getTime() <= candidateStart && i.end.getTime() >= candidateEnd);
    // …e nessun altro appuntamento o evento nel frattempo.
    const hasConflict = busyIntervals.some(
      (interval) => interval.startTime.getTime() < candidateEnd && interval.endTime.getTime() > candidateStart
    );
    if (insideHours && !hasConflict) slots.push(new Date(candidateStart));
  }

  return slots;
}

export type SlotsResult =
  | { success: true; slots: string[] }
  | { success: false; error: string };

export async function getAvailableSlots(input: {
  slug: string;
  serviceId: string;
  date: string;
}): Promise<SlotsResult> {
  const parsed = getSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Richiesta non valida." };
  }

  const tenant = await findActiveTenantBySlug(parsed.data.slug);
  if (!tenant) {
    return { success: false, error: "Centro non disponibile." };
  }

  const service = await findBookableService(tenant.id, parsed.data.serviceId);
  if (!service) {
    return { success: false, error: "Trattamento non disponibile." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.date) || Number.isNaN(new Date(parsed.data.date).getTime())) {
    return { success: false, error: "Data non valida." };
  }

  const slots = await computeAvailableSlots(tenant.id, parsed.data.date, service.durationMinutes);

  return { success: true, slots: slots.map((slot) => slot.toISOString()) };
}

export type BookingConfirmation = {
  clientName: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  confirmed: boolean;
};

export type CreateBookingResult =
  | { success: true; booking: BookingConfirmation }
  | { success: false; error: string };

export async function createPublicBooking(values: unknown): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const tenant = await findActiveTenantBySlug(parsed.data.slug);
  if (!tenant) {
    return { success: false, error: "Centro non disponibile." };
  }

  const service = await findBookableService(tenant.id, parsed.data.serviceId);
  if (!service) {
    return { success: false, error: "Trattamento non disponibile." };
  }

  const startTime = new Date(parsed.data.startTime);
  if (Number.isNaN(startTime.getTime()) || startTime < new Date()) {
    return { success: false, error: "Orario non valido." };
  }

  const endTime = new Date(startTime.getTime() + service.durationMinutes * 60000);

  // Si prenota solo un orario che l'agenda offre davvero (negli orari di lavoro).
  const offered = await computeAvailableSlots(tenant.id, romeDay(startTime), service.durationMinutes);
  if (!offered.some((slot) => slot.getTime() === startTime.getTime())) {
    return { success: false, error: "Questo orario non è più disponibile. Scegli un altro orario." };
  }
  const confirmed = tenant.autoConfirmOnline;

  const normalizedEmail = parsed.data.email?.trim() ? parsed.data.email.trim() : null;
  const normalizedNotes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null;

  try {
    let isNewClient = false;
    const result = await prisma.$transaction(
      async (tx) => {
        const [appointmentConflict, externalConflict] = await Promise.all([
          tx.appointment.findFirst({
            where: {
              tenantId: tenant.id,
              status: { not: "CANCELLED" },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          }),
          tx.externalCalendarEvent.findFirst({
            where: {
              tenantId: tenant.id,
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          }),
        ]);

        if (appointmentConflict || externalConflict) {
          throw new Error("SLOT_TAKEN");
        }

        let client = await tx.client.findFirst({
          where: { tenantId: tenant.id, phone: parsed.data.phone },
        });

        if (client) {
          client = await tx.client.update({
            where: { id: client.id },
            data: {
              firstName: parsed.data.firstName,
              lastName: parsed.data.lastName,
              email: normalizedEmail ?? client.email,
            },
          });
        } else {
          isNewClient = true;
          client = await tx.client.create({
            data: {
              tenantId: tenant.id,
              firstName: parsed.data.firstName,
              lastName: parsed.data.lastName,
              phone: parsed.data.phone,
              email: normalizedEmail,
            },
          });
        }

        const appointment = await tx.appointment.create({
          data: {
            tenantId: tenant.id,
            clientId: client.id,
            serviceId: service.id,
            startTime,
            endTime,
            status: confirmed ? "CONFIRMED" : "BOOKED",
            source: "ONLINE",
            notes: normalizedNotes,
          },
        });

        return { appointment, client };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    after(async () => {
      if (isNewClient) await triggerClientCreated(result.client.tenantId, result.client.id);
      else await closeSupersededRequests(result.client.tenantId, result.client.id, result.appointment.id);
      // Confermata subito: parte la conferma; altrimenti "richiesta ricevuta" e la conferma il centro.
      await triggerAppointmentAutomations(confirmed ? "APPOINTMENT_CONFIRMED" : "BOOKING_REQUESTED", result.appointment.id);
    });

    return {
      success: true,
      booking: {
        clientName: `${result.client.firstName} ${result.client.lastName}`,
        serviceName: service.name,
        startTime: result.appointment.startTime.toISOString(),
        endTime: result.appointment.endTime.toISOString(),
        confirmed,
      },
    };
  } catch {
    return {
      success: false,
      error: "Questo orario non è più disponibile. Scegli un altro orario.",
    };
  }
}
