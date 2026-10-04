"use server";

import { appointmentInclude, toAppointmentDTO, type AppointmentDTO } from "@/app/dashboard/calendar/dto";
import { getTenantContext } from "@/lib/auth-context";
import { getInactiveClients, getUpcomingBirthdays } from "@/lib/insights";
import { prisma } from "@/lib/prisma";

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export type DashboardData = {
  appointments: AppointmentDTO[];
  completedToday: number;
  estimatedRevenueToday: number;
  collectedToday: number;
  newClientsToday: number;
  operatorsToday: number;
  totalClients: number;
  followUp: {
    inactive: number;
    birthdays: number;
    tomorrowReminders: number;
    pendingRequests: number;
  };
};

export async function getDashboardData(): Promise<DashboardData> {
  const { tenantId } = await getTenantContext();
  const { start, end } = getTodayRange();
  const tomorrowStart = new Date(end.getTime() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const [
    appointments,
    collected,
    newClientsToday,
    totalClients,
    inactive,
    birthdays,
    tomorrowReminders,
    pendingRequests,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId, startTime: { gte: start, lte: end } },
      orderBy: { startTime: "asc" },
      include: appointmentInclude,
    }),
    prisma.payment.aggregate({
      where: { tenantId, paidAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.client.count({ where: { tenantId, createdAt: { gte: start, lte: end } } }),
    prisma.client.count({ where: { tenantId } }),
    getInactiveClients(tenantId),
    getUpcomingBirthdays(tenantId, 7),
    prisma.appointment.count({
      where: {
        tenantId,
        startTime: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { in: ["BOOKED", "CONFIRMED"] },
      },
    }),
    prisma.appointment.count({
      where: { tenantId, source: "ONLINE", status: "BOOKED", startTime: { gte: new Date() } },
    }),
  ]);

  const dtos = appointments.map(toAppointmentDTO);
  const billable = dtos.filter((appointment) =>
    ["BOOKED", "CONFIRMED", "COMPLETED"].includes(appointment.status)
  );
  const operatorIds = new Set(
    billable.map((appointment) => appointment.operator?.id).filter((id): id is string => Boolean(id))
  );

  return {
    appointments: dtos,
    completedToday: dtos.filter((appointment) => appointment.status === "COMPLETED").length,
    estimatedRevenueToday: billable.reduce((sum, appointment) => sum + appointment.service.price, 0),
    collectedToday: collected._sum.amount?.toNumber() ?? 0,
    newClientsToday,
    operatorsToday: operatorIds.size,
    totalClients,
    followUp: {
      inactive: inactive.length,
      birthdays: birthdays.length,
      tomorrowReminders,
      pendingRequests,
    },
  };
}
