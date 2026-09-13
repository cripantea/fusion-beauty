"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { createBookingSchema, getSlotsSchema } from "./schema";

const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 19;
const SLOT_STEP_MINUTES = 30;

async function findActiveTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  return tenant && tenant.isActive ? tenant : null;
}

async function findBookableService(tenantId: string, serviceId: string) {
  return prisma.service.findFirst({
    where: { id: serviceId, tenantId, isActive: true, isOnlineBookingEnabled: true },
  });
}

async function computeAvailableSlots(
  tenantId: string,
  date: Date,
  durationMinutes: number
): Promise<Date[]> {
  const dayStart = new Date(date);
  dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(BUSINESS_END_HOUR, 0, 0, 0);

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

  const now = new Date();
  const durationMs = durationMinutes * 60000;
  const stepMs = SLOT_STEP_MINUTES * 60000;
  const slots: Date[] = [];

  for (
    let candidateStart = dayStart.getTime();
    candidateStart + durationMs <= dayEnd.getTime();
    candidateStart += stepMs
  ) {
    if (candidateStart < now.getTime()) {
      continue;
    }

    const candidateEnd = candidateStart + durationMs;

    const hasConflict = busyIntervals.some(
      (interval) =>
        interval.startTime.getTime() < candidateEnd && interval.endTime.getTime() > candidateStart
    );

    if (!hasConflict) {
      slots.push(new Date(candidateStart));
    }
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

  const date = new Date(`${parsed.data.date}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { success: false, error: "Data non valida." };
  }

  const slots = await computeAvailableSlots(tenant.id, date, service.durationMinutes);

  return { success: true, slots: slots.map((slot) => slot.toISOString()) };
}

export type BookingConfirmation = {
  clientName: string;
  serviceName: string;
  startTime: string;
  endTime: string;
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

  const normalizedEmail = parsed.data.email?.trim() ? parsed.data.email.trim() : null;
  const normalizedNotes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null;

  try {
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
            status: "BOOKED",
            notes: normalizedNotes,
          },
        });

        return { appointment, client };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return {
      success: true,
      booking: {
        clientName: `${result.client.firstName} ${result.client.lastName}`,
        serviceName: service.name,
        startTime: result.appointment.startTime.toISOString(),
        endTime: result.appointment.endTime.toISOString(),
      },
    };
  } catch {
    return {
      success: false,
      error: "Questo orario non è più disponibile. Scegli un altro orario.",
    };
  }
}
