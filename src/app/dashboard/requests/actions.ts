"use server";

import { appointmentInclude, toAppointmentDTO, type AppointmentDTO } from "@/app/dashboard/calendar/dto";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

/** Richieste arrivate dal widget online e ancora da confermare. */
export async function getOnlineRequests(): Promise<AppointmentDTO[]> {
  const { tenantId } = await getTenantContext();

  const requests = await prisma.appointment.findMany({
    where: { tenantId, source: "ONLINE", status: "BOOKED", startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    include: appointmentInclude,
  });

  return requests.map(toAppointmentDTO);
}
