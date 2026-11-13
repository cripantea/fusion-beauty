"use server";

import { appointmentInclude, toAppointmentDTO, type AppointmentDTO } from "@/app/dashboard/calendar/dto";
import { findAppointmentsMissingConsent } from "@/lib/consents";
import { getTenantContext } from "@/lib/auth-context";
import { getInactiveClients, getUpcomingBirthdays } from "@/lib/insights";
import { actionableRequestsWhere } from "@/lib/booking-proposals";
import { prisma } from "@/lib/prisma";
import { romeDayRange } from "@/lib/rome-time";


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
  const { tenantId, user } = await getTenantContext();
  const isAdmin = user.role === "ADMIN";
  const privateFilter = isAdmin ? {} : { isPrivate: false };
  // "Oggi" e "domani" del centro, in ora italiana.
  const { start, end } = romeDayRange();
  const { start: tomorrowStart, end: tomorrowEnd } = romeDayRange(new Date(), 1);

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
      where: { tenantId, paidAt: { gte: start, lte: end }, ...privateFilter },
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
    prisma.appointment.count({ where: actionableRequestsWhere(tenantId) }),
  ]);

  const missingConsent = await findAppointmentsMissingConsent(tenantId, appointments);
  const dtos = appointments.map((appointment) => ({
    ...toAppointmentDTO(appointment),
    consentMissing: missingConsent.has(appointment.id),
  }));
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
