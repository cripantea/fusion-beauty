"use server";

import { z } from "zod";

import { appointmentInclude, toAppointmentDTO, type AppointmentDTO } from "@/app/dashboard/calendar/dto";
import { appointmentServiceNames, extraServicesSelect } from "@/lib/appointment-services";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

const paymentInputSchema = z.object({
  appointmentId: z.string().min(1),
  method: z.enum(["CARD", "CASH"]),
  amount: z.number().finite().min(0).max(100000),
  notes: z.string().max(500).optional(),
  isPrivate: z.boolean().optional(),
});

export type PaymentActionResult =
  | { success: true; appointment: AppointmentDTO }
  | { success: false; error: string };

/**
 * Registra l'incasso di un appuntamento in un solo passaggio: crea (o corregge) il pagamento
 * e segna l'appuntamento come completato.
 */
export async function registerPayment(
  input: z.input<typeof paymentInputSchema>
): Promise<PaymentActionResult> {
  const { tenantId, user } = await getTenantContext();

  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Importo non valido." };
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: parsed.data.appointmentId, tenantId },
    select: { id: true, clientId: true, status: true },
  });
  if (!appointment) {
    return { success: false, error: "Appuntamento non trovato." };
  }
  if (appointment.status === "CANCELLED") {
    return { success: false, error: "L'appuntamento è annullato." };
  }

  const amount = Math.round(parsed.data.amount * 100) / 100;

  const isPrivate = parsed.data.isPrivate ?? false;

  await prisma.$transaction([
    prisma.payment.upsert({
      where: { appointmentId: appointment.id },
      create: {
        tenantId,
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        amount,
        method: parsed.data.method,
        notes: parsed.data.notes?.trim() || null,
        isPrivate,
        createdById: user.id,
      },
      update: { amount, method: parsed.data.method, notes: parsed.data.notes?.trim() || null, isPrivate, paidAt: new Date() },
    }),
    prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "COMPLETED" },
    }),
  ]);

  const updated = await prisma.appointment.findFirstOrThrow({
    where: { id: appointment.id, tenantId },
    include: appointmentInclude,
  });

  return { success: true, appointment: toAppointmentDTO(updated) };
}

const TIME_ZONE = "Europe/Rome";

function romeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Istante della mezzanotte italiana di quel giorno (month 1-12; day può sforare, come Date.UTC). */
function romeMidnight(year: number, month: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const got = romeParts(guess);
  // A mezzanotte UTC a Roma è l'1 (CET) o le 2 (CEST): si torna indietro di quelle ore.
  const offsetMinutes = got.hour * 60 + got.minute;
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

export type PaymentRowDTO = {
  id: string;
  amount: number;
  method: "CASH" | "CARD" | "TRANSFER" | "OTHER";
  paidAt: Date;
  client: { id: string; firstName: string; lastName: string };
  serviceName: string | null;
};

export type PaymentsOverview = {
  todayTotal: number;
  todayCard: number;
  todayCash: number;
  monthTotal: number;
  toCollect: AppointmentDTO[];
  recent: PaymentRowDTO[];
};

export async function getPaymentsOverview(): Promise<PaymentsOverview> {
  const { tenantId, user } = await getTenantContext();
  const isAdmin = user.role === "ADMIN";
  const privateFilter = isAdmin ? {} : { isPrivate: false };

  // Giorno e mese nell'ora italiana (il server gira in UTC).
  const now = new Date();
  const today = romeParts(now);
  const dayStart = romeMidnight(today.year, today.month, today.day);
  const dayEnd = new Date(romeMidnight(today.year, today.month, today.day + 1).getTime() - 1);
  const monthStart = romeMidnight(today.year, today.month, 1);
  const lookback = romeMidnight(today.year, today.month, today.day - 30);

  const [todayGroups, monthSum, toCollect, recent] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      where: { tenantId, paidAt: { gte: dayStart, lte: dayEnd }, ...privateFilter },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { tenantId, paidAt: { gte: monthStart }, ...privateFilter },
      _sum: { amount: true },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        payment: null,
        status: { in: ["BOOKED", "CONFIRMED", "COMPLETED"] },
        startTime: { gte: lookback, lte: dayEnd },
      },
      orderBy: { startTime: "desc" },
      include: appointmentInclude,
    }),
    prisma.payment.findMany({
      where: { tenantId, ...privateFilter },
      orderBy: { paidAt: "desc" },
      take: 30,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        appointment: { select: { service: { select: { name: true } }, extraServices: extraServicesSelect } },
        plan: { select: { name: true } },
      },
    }),
  ]);

  const byMethod = (method: string) =>
    todayGroups.find((group) => group.method === method)?._sum.amount?.toNumber() ?? 0;
  const todayTotal = todayGroups.reduce((sum, group) => sum + (group._sum.amount?.toNumber() ?? 0), 0);

  return {
    todayTotal,
    todayCard: byMethod("CARD"),
    todayCash: byMethod("CASH"),
    monthTotal: monthSum._sum.amount?.toNumber() ?? 0,
    toCollect: toCollect.map(toAppointmentDTO),
    recent: recent.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toNumber(),
      method: payment.method,
      paidAt: payment.paidAt,
      client: payment.client,
      serviceName: (payment.appointment ? appointmentServiceNames(payment.appointment) : null) ?? (payment.plan ? `Percorso ${payment.plan.name}` : null),
    })),
  };
}
