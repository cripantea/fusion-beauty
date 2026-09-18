"use server";

import type { AppointmentDTO } from "@/app/dashboard/calendar/actions";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

const appointmentInclude = {
  client: { select: { id: true, firstName: true, lastName: true } },
  service: { select: { id: true, name: true, durationMinutes: true } },
  operator: { select: { id: true, firstName: true, lastName: true } },
  payment: { select: { id: true, amount: true, method: true } },
} as const;

function toAppointmentDTO(appointment: {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentDTO["status"];
  notes: string | null;
  price: { toNumber(): number } | null;
  reminderStatus: "NONE" | "SCHEDULED" | "SENT" | "FAILED";
  client: AppointmentDTO["client"];
  service: AppointmentDTO["service"];
  operator: AppointmentDTO["operator"];
  payment: { id: string; amount: { toNumber(): number }; method: string } | null;
}): AppointmentDTO {
  return {
    ...appointment,
    price: appointment.price?.toNumber() ?? null,
    payment: appointment.payment
      ? { ...appointment.payment, amount: appointment.payment.amount.toNumber() }
      : null,
  };
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export type DashboardMetrics = {
  todayAppointmentsTotal: number;
  todayAppointmentsCompleted: number;
  todayAppointmentsCancelled: number;
  todayNoShow: number;
  newClientsThisMonth: number;
  totalClientsActive: number;
  inactiveClients90: number;
  estimatedRevenueToday: number;
  realRevenueToday: number;
  revenueCardToday: number;
  revenueCashToday: number;
  pendingBookingRequests: number;
  operatorStats: Array<{
    id: string;
    firstName: string;
    lastName: string;
    appointmentsToday: number;
    revenueToday: number;
    nextAppointment: Date | null;
  }>;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { tenantId } = await getTenantContext();
  const { start, end } = getTodayRange();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [
    todayAppts,
    todayCompleted,
    todayCancelled,
    todayNoShow,
    newClientsThisMonth,
    totalClientsActive,
    todayPayments,
    pendingBookingRequests,
    operators,
  ] = await Promise.all([
    prisma.appointment.count({
      where: { tenantId, startTime: { gte: start, lte: end } },
    }),
    prisma.appointment.count({
      where: { tenantId, startTime: { gte: start, lte: end }, status: "COMPLETED" },
    }),
    prisma.appointment.count({
      where: { tenantId, startTime: { gte: start, lte: end }, status: "CANCELLED" },
    }),
    prisma.appointment.count({
      where: { tenantId, startTime: { gte: start, lte: end }, status: "NO_SHOW" },
    }),
    prisma.client.count({
      where: { tenantId, createdAt: { gte: monthStart } },
    }),
    prisma.client.count({ where: { tenantId } }),
    prisma.payment.findMany({
      where: { tenantId, paidAt: { gte: start, lte: end } },
      select: { amount: true, method: true },
    }),
    prisma.bookingRequest.count({ where: { tenantId, status: "PENDING" } }),
    prisma.user.findMany({
      where: { tenantId, isActive: true, role: { in: ["ADMIN", "OPERATOR"] } },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  // Inactive clients: last appointment > 90 days ago or no appointment at all
  const activeClientIds = await prisma.appointment.findMany({
    where: { tenantId, startTime: { gte: ninetyDaysAgo }, status: { not: "CANCELLED" } },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  const activeClientIdSet = new Set(activeClientIds.map((a) => a.clientId));
  const allClientIds = await prisma.client.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const inactiveClients90 = allClientIds.filter((c) => !activeClientIdSet.has(c.id)).length;

  // Estimated revenue from today's appointments (service price)
  const revenueAppts = await prisma.appointment.findMany({
    where: {
      tenantId,
      startTime: { gte: start, lte: end },
      status: { in: ["BOOKED", "CONFIRMED", "COMPLETED"] },
    },
    select: { price: true, service: { select: { price: true } } },
  });
  const estimatedRevenueToday = revenueAppts.reduce(
    (sum, a) => sum + (a.price?.toNumber() ?? a.service.price.toNumber()),
    0
  );

  const realRevenueToday = todayPayments.reduce((s, p) => s + p.amount.toNumber(), 0);
  const revenueCardToday = todayPayments.filter((p) => p.method === "CARD").reduce((s, p) => s + p.amount.toNumber(), 0);
  const revenueCashToday = todayPayments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount.toNumber(), 0);

  // Per-operator stats for today
  const operatorStats = await Promise.all(
    operators.map(async (op) => {
      const [opAppts, opNextAppt] = await Promise.all([
        prisma.appointment.findMany({
          where: { tenantId, operatorId: op.id, startTime: { gte: start, lte: end } },
          include: { payment: { select: { amount: true } }, service: { select: { price: true } } },
        }),
        prisma.appointment.findFirst({
          where: {
            tenantId,
            operatorId: op.id,
            startTime: { gte: new Date() },
            status: { in: ["BOOKED", "CONFIRMED"] },
          },
          orderBy: { startTime: "asc" },
          select: { startTime: true },
        }),
      ]);

      const revenueToday = opAppts
        .filter((a) => a.status === "COMPLETED" && a.payment)
        .reduce((s, a) => s + (a.payment?.amount.toNumber() ?? 0), 0);

      return {
        id: op.id,
        firstName: op.firstName,
        lastName: op.lastName,
        appointmentsToday: opAppts.length,
        revenueToday,
        nextAppointment: opNextAppt?.startTime ?? null,
      };
    })
  );

  return {
    todayAppointmentsTotal: todayAppts,
    todayAppointmentsCompleted: todayCompleted,
    todayAppointmentsCancelled: todayCancelled,
    todayNoShow,
    newClientsThisMonth,
    totalClientsActive,
    inactiveClients90,
    estimatedRevenueToday,
    realRevenueToday,
    revenueCardToday,
    revenueCashToday,
    pendingBookingRequests,
    operatorStats,
  };
}

export async function getTodayAppointments(): Promise<AppointmentDTO[]> {
  const { tenantId } = await getTenantContext();
  const { start, end } = getTodayRange();

  const appointments = await prisma.appointment.findMany({
    where: { tenantId, startTime: { gte: start, lte: end } },
    orderBy: { startTime: "asc" },
    include: appointmentInclude,
  });

  return appointments.map(toAppointmentDTO);
}
