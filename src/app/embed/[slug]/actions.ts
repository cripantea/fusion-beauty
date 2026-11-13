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

type Db = Prisma.TransactionClient;
type Interval = { start: number; end: number };

/**
 * Agenda del giorno per un trattamento, come su Treatwell/Fresha: ogni
 * operatrice che lo esegue ha le sue fasce di lavoro (le eccezioni del giorno
 * vincono: senza orari = assente) meno i suoi appuntamenti e impegni.
 * Appuntamenti senza operatrice ed eventi del calendario collegato tengono
 * occupata una qualsiasi operatrice libera in quell'orario ("shared").
 * Senza orari di lavoro per nessuno: una sola poltrona negli orari standard.
 */
type DayPlan =
  | { mode: "default"; open: Interval[]; busy: Interval[] }
  | {
      mode: "staff";
      operators: { id: string; shifts: Interval[]; busy: Interval[]; booked: number }[];
      shared: Interval[];
    };

const overlaps = (a: Interval, start: number, end: number) => a.start < end && a.end > start;
const toInterval = (r: { startTime: Date; endTime: Date }): Interval => ({ start: r.startTime.getTime(), end: r.endTime.getTime() });

async function loadDayPlan(db: Db, tenantId: string, day: string, serviceId: string): Promise<DayPlan> {
  const dow = ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1=lun … 7=dom
  const anyHours = await db.workingHours.count({ where: { tenantId, isActive: true } });

  if (anyHours === 0) {
    if (!DEFAULT_HOURS.days.includes(dow)) return { mode: "default", open: [], busy: [] };
    const open = { start: romeTime(day, DEFAULT_HOURS.start).getTime(), end: romeTime(day, DEFAULT_HOURS.end).getTime() };
    const window = { startTime: { lt: new Date(open.end) }, endTime: { gt: new Date(open.start) } };
    const [appointments, external] = await Promise.all([
      db.appointment.findMany({ where: { tenantId, status: { in: ["BOOKED", "CONFIRMED"] }, ...window }, select: { startTime: true, endTime: true } }),
      db.externalCalendarEvent.findMany({ where: { tenantId, ...window }, select: { startTime: true, endTime: true } }),
    ]);
    return { mode: "default", open: [open], busy: [...appointments, ...external].map(toInterval) };
  }

  // Operatrici attive che eseguono il trattamento (anche la titolare, se ha orari).
  const able = { tenantId, isActive: true, excludedServices: { none: { id: serviceId } } };
  const [hours, exceptions] = await Promise.all([
    db.workingHours.findMany({
      where: { tenantId, isActive: true, dayOfWeek: dow, user: able },
      select: { userId: true, startTime: true, endTime: true },
    }),
    db.staffException.findMany({
      where: { tenantId, date: new Date(`${day}T00:00:00Z`), user: able },
      select: { userId: true, startTime: true, endTime: true },
    }),
  ]);

  const shifts = new Map<string, Interval[]>();
  const addShift = (userId: string, from: string, to: string) => {
    const shift = { start: romeTime(day, from).getTime(), end: romeTime(day, to).getTime() };
    if (shift.end > shift.start) shifts.set(userId, [...(shifts.get(userId) ?? []), shift]);
  };
  const exceptionUsers = new Set(exceptions.map((e) => e.userId));
  for (const h of hours) if (!exceptionUsers.has(h.userId)) addShift(h.userId, h.startTime, h.endTime);
  for (const e of exceptions) if (e.startTime && e.endTime) addShift(e.userId, e.startTime, e.endTime);
  if (shifts.size === 0) return { mode: "staff", operators: [], shared: [] };

  const all = [...shifts.values()].flat();
  const window = {
    startTime: { lt: new Date(Math.max(...all.map((i) => i.end))) },
    endTime: { gt: new Date(Math.min(...all.map((i) => i.start))) },
  };
  const userIds = [...shifts.keys()];
  const [appointments, blocks, external] = await Promise.all([
    db.appointment.findMany({
      where: { tenantId, status: { in: ["BOOKED", "CONFIRMED"] }, ...window },
      select: { operatorId: true, startTime: true, endTime: true },
    }),
    db.staffBlock.findMany({ where: { tenantId, userId: { in: userIds }, ...window }, select: { userId: true, startTime: true, endTime: true } }),
    db.externalCalendarEvent.findMany({ where: { tenantId, ...window }, select: { startTime: true, endTime: true } }),
  ]);

  return {
    mode: "staff",
    operators: userIds.map((id) => {
      const own = appointments.filter((a) => a.operatorId === id);
      return {
        id,
        shifts: shifts.get(id) ?? [],
        busy: [...own, ...blocks.filter((b) => b.userId === id)].map(toInterval),
        booked: own.length,
      };
    }),
    shared: [...appointments.filter((a) => !a.operatorId), ...external].map(toInterval),
  };
}

/**
 * Operatrici libere per tutto [start, end), dalla meno impegnata del giorno.
 * `null` = orario non prenotabile; `[]` (agenda standard) = libero, senza operatrice.
 */
function freeOperatorsAt(plan: DayPlan, start: number, end: number): string[] | null {
  if (plan.mode === "default") {
    const inside = plan.open.some((i) => i.start <= start && i.end >= end);
    return inside && !plan.busy.some((b) => overlaps(b, start, end)) ? [] : null;
  }
  const free = plan.operators.filter(
    (op) => op.shifts.some((s) => s.start <= start && s.end >= end) && !op.busy.some((b) => overlaps(b, start, end))
  );
  // Ogni appuntamento senza operatrice o evento esterno nel frattempo occupa una di loro.
  const taken = plan.shared.filter((b) => overlaps(b, start, end)).length;
  if (free.length - taken < 1) return null;
  return free.sort((a, b) => a.booked - b.booked).map((op) => op.id);
}

function slotsOf(plan: DayPlan, durationMinutes: number): Date[] {
  const ranges = plan.mode === "default" ? plan.open : plan.operators.flatMap((op) => op.shifts);
  if (ranges.length === 0) return [];
  const dayStart = Math.min(...ranges.map((r) => r.start));
  const dayEnd = Math.max(...ranges.map((r) => r.end));

  const now = Date.now();
  const durationMs = durationMinutes * 60000;
  const stepMs = SLOT_STEP_MINUTES * 60000;
  const slots: Date[] = [];

  for (let candidateStart = dayStart; candidateStart + durationMs <= dayEnd; candidateStart += stepMs) {
    if (candidateStart < now) continue;
    // Tutto il trattamento negli orari di un'operatrice libera.
    if (freeOperatorsAt(plan, candidateStart, candidateStart + durationMs)) slots.push(new Date(candidateStart));
  }

  return slots;
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

  const plan = await loadDayPlan(prisma, tenant.id, parsed.data.date, service.id);
  const slots = slotsOf(plan, service.durationMinutes);

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
  const confirmed = tenant.autoConfirmOnline;

  const normalizedEmail = parsed.data.email?.trim() ? parsed.data.email.trim() : null;
  const normalizedNotes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null;

  try {
    let isNewClient = false;
    const result = await prisma.$transaction(
      async (tx) => {
        // Si prenota solo un orario che l'agenda offre davvero (negli orari di
        // lavoro), ricontrollato qui dentro: due prenotazioni insieme non passano.
        const plan = await loadDayPlan(tx, tenant.id, romeDay(startTime), service.id);
        const offered = slotsOf(plan, service.durationMinutes).some((slot) => slot.getTime() === startTime.getTime());
        const free = offered ? freeOperatorsAt(plan, startTime.getTime(), endTime.getTime()) : null;
        if (!free) {
          throw new Error("SLOT_TAKEN");
        }
        // Va all'operatrice libera meno impegnata quel giorno (agenda standard: nessuna).
        const operatorId = free[0] ?? null;

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
            operatorId,
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
