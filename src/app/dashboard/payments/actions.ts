"use server";

import { z } from "zod";

import { appointmentInclude, toAppointmentDTO, type AppointmentDTO } from "@/app/dashboard/calendar/dto";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

const paymentInputSchema = z.object({
  appointmentId: z.string().min(1),
  method: z.enum(["CARD", "CASH"]),
  amount: z.number().finite().min(0).max(100000),
  notes: z.string().max(500).optional(),
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
        createdById: user.id,
      },
      update: { amount, method: parsed.data.method, notes: parsed.data.notes?.trim() || null, paidAt: new Date() },
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
  const { tenantId } = await getTenantContext();

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lookback = new Date(dayStart);
  lookback.setDate(lookback.getDate() - 30);

  const [todayGroups, monthSum, toCollect, recent] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      where: { tenantId, paidAt: { gte: dayStart, lte: dayEnd } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { tenantId, paidAt: { gte: monthStart } },
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
      where: { tenantId },
      orderBy: { paidAt: "desc" },
      take: 30,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        appointment: { select: { service: { select: { name: true } } } },
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
      serviceName: payment.appointment?.service.name ?? null,
    })),
  };
}
