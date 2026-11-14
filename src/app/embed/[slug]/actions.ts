"use server";

import { after } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { triggerAppointmentAutomations, triggerClientCreated } from "@/lib/automation-engine";
import { appointmentParts, operatorBlocks } from "@/lib/appointment-services";
import { closeSupersededRequests } from "@/lib/booking-proposals";
import { findClientIdByPhone } from "@/lib/client-phone";
import { prepareConsentLinks } from "@/lib/consents";

import { createBookingSchema, getSlotsSchema } from "./schema";

// Senza orari di lavoro impostati per lo staff: lun–sab 8–19.
const DEFAULT_HOURS = { start: "08:00", end: "19:00", days: [1, 2, 3, 4, 5, 6] };
// Online si prenota con almeno 24 ore di anticipo: per prima, il centro la sente al telefono.
const MIN_NOTICE_MS = 24 * 60 * 60 * 1000;
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
 * Agenda del giorno per un trattamento, come su Treatwell/Fresha: si prenota
 * sempre con un'operatrice. Ognuna che esegue il trattamento ha le sue fasce
 * di lavoro (le eccezioni del giorno vincono: senza orari = assente; chi non
 * ha ancora orari impostati lavora negli orari standard) meno i suoi
 * appuntamenti e impegni. Eventi del calendario collegato e vecchi
 * appuntamenti senza operatrice tengono occupata un'operatrice libera ("shared").
 */
type DayPlan = {
  operators: { id: string; shifts: Interval[]; busy: Interval[]; booked: number }[];
  shared: Interval[];
};

const overlaps = (a: Interval, start: number, end: number) => a.start < end && a.end > start;
const toInterval = (r: { startTime: Date; endTime: Date }): Interval => ({ start: r.startTime.getTime(), end: r.endTime.getTime() });

async function loadDayPlan(db: Db, tenantId: string, day: string, serviceId: string, operatorId?: string | null): Promise<DayPlan> {
  const dow = ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1=lun … 7=dom

  // Le stesse operatrici delle colonne in agenda, se eseguono il trattamento.
  const operators = await db.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: ["ADMIN", "OPERATOR"] },
      excludedServices: { none: { id: serviceId } },
      // Scelta dalla cliente: solo i suoi orari liberi.
      ...(operatorId ? { id: operatorId } : {}),
    },
    select: {
      id: true,
      workingHours: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
      staffExceptions: { where: { date: new Date(`${day}T00:00:00Z`) }, select: { startTime: true, endTime: true } },
    },
  });

  // Orari di default solo per un centro che non ne ha impostati: altrimenti chi non ha
  // orari (es. in standby) online non c'è, salvo i giorni aperti con un imprevisto.
  const hoursConfigured = (await db.workingHours.count({ where: { tenantId, isActive: true } })) > 0;

  const shifts = new Map<string, Interval[]>();
  const addShift = (userId: string, from: string, to: string) => {
    const shift = { start: romeTime(day, from).getTime(), end: romeTime(day, to).getTime() };
    if (shift.end > shift.start) shifts.set(userId, [...(shifts.get(userId) ?? []), shift]);
  };
  for (const op of operators) {
    if (op.staffExceptions.length > 0) {
      for (const e of op.staffExceptions) if (e.startTime && e.endTime) addShift(op.id, e.startTime, e.endTime);
    } else if (op.workingHours.length > 0) {
      for (const h of op.workingHours) if (h.dayOfWeek === dow) addShift(op.id, h.startTime, h.endTime);
    } else if (!hoursConfigured && DEFAULT_HOURS.days.includes(dow)) {
      addShift(op.id, DEFAULT_HOURS.start, DEFAULT_HOURS.end);
    }
  }
  if (shifts.size === 0) return { operators: [], shared: [] };

  const all = [...shifts.values()].flat();
  const window = {
    startTime: { lt: new Date(Math.max(...all.map((i) => i.end))) },
    endTime: { gt: new Date(Math.min(...all.map((i) => i.start))) },
  };
  const userIds = [...shifts.keys()];
  const [appointments, blocks, external] = await Promise.all([
    db.appointment.findMany({
      where: { tenantId, status: { in: ["BOOKED", "CONFIRMED"] }, ...window },
      select: {
        operatorId: true,
        startTime: true,
        endTime: true,
        service: { select: { durationMinutes: true } },
        extraServices: { orderBy: { position: "asc" }, select: { durationMinutes: true, operatorId: true } },
      },
    }),
    db.staffBlock.findMany({ where: { tenantId, userId: { in: userIds }, ...window }, select: { userId: true, startTime: true, endTime: true } }),
    db.externalCalendarEvent.findMany({ where: { tenantId, ...window }, select: { startTime: true, endTime: true } }),
  ]);

  return {
    operators: userIds.map((id) => {
      // Con più trattamenti e operatrici diverse, ognuna è occupata solo nel suo tratto.
      const own = appointments.flatMap((a) =>
        operatorBlocks(a.startTime, a.endTime, appointmentParts(a)).filter((block) => block.operatorId === id)
      );
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

/** Operatrici libere per tutto [start, end), dalla meno impegnata del giorno; `null` = orario non prenotabile. */
function freeOperatorsAt(plan: DayPlan, start: number, end: number): string[] | null {
  const free = plan.operators.filter(
    (op) => op.shifts.some((s) => s.start <= start && s.end >= end) && !op.busy.some((b) => overlaps(b, start, end))
  );
  // Ogni appuntamento senza operatrice o evento esterno nel frattempo occupa una di loro.
  const taken = plan.shared.filter((b) => overlaps(b, start, end)).length;
  if (free.length - taken < 1) return null;
  return free.sort((a, b) => a.booked - b.booked).map((op) => op.id);
}

function slotsOf(plan: DayPlan, durationMinutes: number): Date[] {
  const ranges = plan.operators.flatMap((op) => op.shifts);
  if (ranges.length === 0) return [];
  const dayStart = Math.min(...ranges.map((r) => r.start));
  const dayEnd = Math.max(...ranges.map((r) => r.end));

  const earliest = Date.now() + MIN_NOTICE_MS;
  const durationMs = durationMinutes * 60000;
  const stepMs = SLOT_STEP_MINUTES * 60000;
  const slots: Date[] = [];

  for (let candidateStart = dayStart; candidateStart + durationMs <= dayEnd; candidateStart += stepMs) {
    if (candidateStart < earliest) continue;
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
  operatorId?: string | null;
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

  const plan = await loadDayPlan(prisma, tenant.id, parsed.data.date, service.id, parsed.data.operatorId);
  const slots = slotsOf(plan, service.durationMinutes);

  return { success: true, slots: slots.map((slot) => slot.toISOString()) };
}

/**
 * Giorni in cui almeno un'operatrice che fa il trattamento lavora: gli altri
 * (es. mercoledì e domenica) nel calendario si vedono grigi e non si cliccano.
 * Anche i giorni aperti in via eccezionale con un "imprevisto" restano cliccabili.
 */
export type OpenDays = { weekdays: number[]; extraDates: string[] };
export type BookableOperator = OpenDays & { id: string; name: string };

export async function getOpenDays(input: {
  slug: string;
  serviceId: string;
}): Promise<({ success: true; operators: BookableOperator[] } & OpenDays) | { success: false }> {
  const tenant = await findActiveTenantBySlug(input.slug);
  if (!tenant) return { success: false };
  const service = await findBookableService(tenant.id, input.serviceId);
  if (!service) return { success: false };

  const hoursConfigured = (await prisma.workingHours.count({ where: { tenantId: tenant.id, isActive: true } })) > 0;
  const today = romeDay(new Date());
  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id, isActive: true, role: { in: ["ADMIN", "OPERATOR"] }, excludedServices: { none: { id: service.id } } },
    orderBy: [{ agendaOrder: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      workingHours: { where: { isActive: true }, select: { dayOfWeek: true } },
      staffExceptions: { where: { date: { gte: new Date(`${today}T00:00:00Z`) }, startTime: { not: null } }, select: { date: true } },
    },
  });
  // Le operatrici che la cliente può scegliere: chi fa il trattamento e lavora almeno un giorno.
  const operators: BookableOperator[] = users
    .map((op) => ({
      id: op.id,
      name: op.firstName,
      weekdays: hoursConfigured ? [...new Set(op.workingHours.map((h) => h.dayOfWeek))].sort() : DEFAULT_HOURS.days,
      extraDates: [...new Set(op.staffExceptions.map((e) => e.date.toISOString().slice(0, 10)))],
    }))
    .filter((op) => op.weekdays.length > 0 || op.extraDates.length > 0);
  const weekdays = [...new Set(operators.flatMap((op) => op.weekdays))].sort();
  const extraDates = [...new Set(operators.flatMap((op) => op.extraDates))];
  return { success: true, operators, weekdays, extraDates };
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
  if (startTime.getTime() < Date.now() + MIN_NOTICE_MS) {
    return { success: false, error: "Online si prenota con almeno 24 ore di anticipo: per prima chiamaci." };
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
        const plan = await loadDayPlan(tx, tenant.id, romeDay(startTime), service.id, parsed.data.operatorId);
        const offered = slotsOf(plan, service.durationMinutes).some((slot) => slot.getTime() === startTime.getTime());
        const free = offered ? freeOperatorsAt(plan, startTime.getTime(), endTime.getTime()) : null;
        if (!free || free.length === 0) {
          throw new Error("SLOT_TAKEN");
        }
        // Va all'operatrice scelta dalla cliente, altrimenti alla libera meno impegnata quel giorno.
        const operatorId = free[0];

        // Stessa cliente anche se il numero è scritto diverso (+39, spazi…): nome e cognome in scheda restano.
        const existingId = await findClientIdByPhone(tenant.id, parsed.data.phone, tx);
        let client = existingId ? await tx.client.findUnique({ where: { id: existingId } }) : null;

        if (client) {
          if (!client.email && normalizedEmail) {
            client = await tx.client.update({ where: { id: client.id }, data: { email: normalizedEmail } });
          }
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
      // Trattamento con consenso (es. laser): il link da firmare è già pronto per il centro (non si manda nulla).
      await prepareConsentLinks(result.client.tenantId, result.client.id, service.id);
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
