import { prisma } from "@/lib/prisma";

/**
 * Incassi in cassa (Incassa, POS, contanti) attivi o no per il centro.
 * Spenti (default): niente sezione Pagamenti; l'incasso è stimato dai prezzi di
 * listino dei trattamenti svolti (non verificato: niente sconti né extra,
 * fuori assenti e annullati) e gli appuntamenti passati si completano da soli.
 */
export async function isPaymentsEnabled(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { paymentsEnabled: true } });
  return tenant?.paymentsEnabled ?? false;
}

export const ESTIMATE_NOTE =
  "Stima dai prezzi di listino dei trattamenti svolti: non verificata, non tiene conto di sconti ed extra; assenti e annullati esclusi.";

/**
 * Senza incassi in cassa nessuno segna più gli appuntamenti come completati
 * (prima lo faceva "Incassa"): quelli confermati o fissati in agenda, finiti da
 * almeno 30 minuti, diventano "Completato". Le richieste online mai confermate
 * restano come sono. Chi non si è presentata si segna "Assente" dall'agenda.
 * Gira nel worker ogni 15 minuti.
 */
export async function autoCompletePastAppointments(now = new Date()) {
  const before = new Date(now.getTime() - 30 * 60_000);
  const result = await prisma.appointment.updateMany({
    where: {
      tenant: { paymentsEnabled: false, isActive: true },
      endTime: { lt: before },
      OR: [{ status: "CONFIRMED" }, { status: "BOOKED", source: "INTERNAL" }],
    },
    data: { status: "COMPLETED" },
  });
  return result.count;
}
