"use server";

import type { AppointmentDTO } from "@/app/dashboard/calendar/actions";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

const appointmentInclude = {
  client: { select: { id: true, firstName: true, lastName: true } },
  service: { select: { id: true, name: true, durationMinutes: true } },
  operator: { select: { id: true, firstName: true, lastName: true } },
} as const;

function toAppointmentDTO(appointment: {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentDTO["status"];
  notes: string | null;
  client: AppointmentDTO["client"];
  service: AppointmentDTO["service"];
  operator: AppointmentDTO["operator"];
}): AppointmentDTO {
  return { ...appointment };
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
  newClientsThisMonth: number;
  estimatedRevenueToday: number;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { tenantId } = await getTenantContext();
  const { start, end } = getTodayRange();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    todayAppointmentsTotal,
    todayAppointmentsCompleted,
    newClientsThisMonth,
    revenueAppointments,
  ] = await Promise.all([
    prisma.appointment.count({
      where: { tenantId, startTime: { gte: start, lte: end } },
    }),
    prisma.appointment.count({
      where: { tenantId, startTime: { gte: start, lte: end }, status: "COMPLETED" },
    }),
    prisma.client.count({
      where: { tenantId, createdAt: { gte: monthStart } },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: start, lte: end },
        status: { in: ["BOOKED", "CONFIRMED", "COMPLETED"] },
      },
      select: { service: { select: { price: true } } },
    }),
  ]);

  const estimatedRevenueToday = revenueAppointments.reduce(
    (sum, appointment) => sum + appointment.service.price.toNumber(),
    0
  );

  return {
    todayAppointmentsTotal,
    todayAppointmentsCompleted,
    newClientsThisMonth,
    estimatedRevenueToday,
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
