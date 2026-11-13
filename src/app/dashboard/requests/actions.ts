"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { appointmentInclude, toAppointmentDTO, type AppointmentDTO } from "@/app/dashboard/calendar/dto";
import { getTenantContext, requireTenantAdmin } from "@/lib/auth-context";
import { proposeNewTime } from "@/lib/booking-proposals";
import { prisma } from "@/lib/prisma";

export type RequestDTO = AppointmentDTO & {
  /** Già confermata in automatico (prenotazione online su un orario libero). */
  autoConfirmed: boolean;
  proposal: { status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"; start: Date; createdAt: Date; respondedAt: Date | null } | null;
};

/**
 * Prenotazioni dal sito da guardare: quelle ancora da confermare (conferma
 * automatica spenta), quelle confermate da sole negli ultimi 2 giorni e quelle
 * con uno spostamento in corso o rifiutato dalla cliente.
 */
export async function getOnlineRequests(): Promise<RequestDTO[]> {
  const { tenantId } = await getTenantContext();
  const now = Date.now();
  const openProposal = { proposals: { some: { status: { in: ["PENDING" as const, "DECLINED" as const] }, createdAt: { gte: new Date(now - 14 * 86_400_000) } } } };

  const requests = await prisma.appointment.findMany({
    where: {
      tenantId,
      source: "ONLINE",
      // Tutte le prenotazioni dal sito degli ultimi 7 giorni (anche già iniziate o annullate),
      // più quelle con una proposta di orario ancora aperta.
      OR: [{ createdAt: { gte: new Date(now - 7 * 86_400_000) } }, { status: { in: ["BOOKED", "CONFIRMED"] }, ...openProposal }],
    },
    orderBy: { createdAt: "desc" },
    include: { ...appointmentInclude, proposals: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return requests.map((request) => {
    const last = request.proposals[0];
    return {
      ...toAppointmentDTO(request),
      autoConfirmed: request.status === "CONFIRMED",
      proposal: last && last.status !== "CANCELLED"
        ? { status: last.status, start: last.proposedStart, createdAt: last.createdAt, respondedAt: last.respondedAt }
        : null,
    };
  });
}

/** Conferma automatica delle prenotazioni online (solo admin). */
export async function setAutoConfirmOnline(enabled: boolean): Promise<{ success: true } | { success: false; error: string }> {
  const { tenantId } = await requireTenantAdmin();
  await prisma.tenant.update({ where: { id: tenantId }, data: { autoConfirmOnline: enabled } });
  revalidatePath("/dashboard/requests");
  return { success: true };
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
