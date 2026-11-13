"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { appointmentInclude, toAppointmentDTO, type AppointmentDTO } from "@/app/dashboard/calendar/dto";
import { getTenantContext } from "@/lib/auth-context";
import { proposeNewTime } from "@/lib/booking-proposals";
import { prisma } from "@/lib/prisma";

export type RequestDTO = AppointmentDTO & {
  proposal: { status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"; start: Date; createdAt: Date; respondedAt: Date | null } | null;
};

/** Richieste arrivate dal sito ancora da confermare, con l'eventuale proposta di un altro orario. */
export async function getOnlineRequests(): Promise<RequestDTO[]> {
  const { tenantId } = await getTenantContext();

  const requests = await prisma.appointment.findMany({
    where: { tenantId, source: "ONLINE", status: "BOOKED", startTime: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
    orderBy: { startTime: "asc" },
    include: { ...appointmentInclude, proposals: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return requests.map((request) => {
    const last = request.proposals[0];
    return {
      ...toAppointmentDTO(request),
      proposal: last && last.status !== "CANCELLED"
        ? { status: last.status, start: last.proposedStart, createdAt: last.createdAt, respondedAt: last.respondedAt }
        : null,
    };
  });
}

const proposeSchema = z.object({
  appointmentId: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  operatorId: z.string().min(1).nullable(),
});

/** Propone alla cliente un altro orario su WhatsApp (con i pulsanti per rispondere). */
export async function proposeAlternative(values: z.input<typeof proposeSchema>): Promise<{ success: true } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();
  const parsed = proposeSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: "Scegli giorno e orario." };
  if (parsed.data.operatorId) {
    const operator = await prisma.user.findFirst({ where: { id: parsed.data.operatorId, tenantId }, select: { id: true } });
    if (!operator) return { success: false, error: "Operatrice non trovata." };
  }
  const result = await proposeNewTime(tenantId, {
    appointmentId: parsed.data.appointmentId,
    start: new Date(parsed.data.start),
    operatorId: parsed.data.operatorId,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/dashboard/requests");
  return { success: true };
}
