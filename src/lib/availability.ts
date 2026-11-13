import { prisma } from "@/lib/prisma";

/**
 * Controllo unico degli accavallamenti, usato da agenda, proposte di orario e
 * prenotazione online. Importato anche dal webhook/worker: niente "server-only".
 *
 * Con un'operatrice: non deve avere altri appuntamenti attivi né impegni in
 * quell'orario. Senza operatrice ("Qualsiasi"): si controllano solo gli
 * appuntamenti senza operatrice e gli eventi del calendario esterno del centro.
 */
export async function findClash(
  tenantId: string,
  input: { operatorId: string | null; start: Date; end: Date; excludeAppointmentId?: string }
): Promise<string | null> {
  const { operatorId, start, end, excludeAppointmentId } = input;
  const overlap = { startTime: { lt: end }, endTime: { gt: start } };

  const appointment = await prisma.appointment.findFirst({
    where: {
      tenantId,
      operatorId,
      status: { in: ["BOOKED", "CONFIRMED"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      ...overlap,
    },
    select: { client: { select: { firstName: true, lastName: true } }, startTime: true },
  });
  if (appointment) {
    const who = `${appointment.client.firstName} ${appointment.client.lastName}`.trim();
    return operatorId
      ? `L'operatrice ha già un appuntamento in quell'orario (${who}).`
      : `In quell'orario c'è già un appuntamento senza operatrice (${who}).`;
  }

  if (operatorId) {
    const block = await prisma.staffBlock.findFirst({ where: { tenantId, userId: operatorId, ...overlap }, select: { title: true } });
    if (block) return `L'operatrice ha un impegno in quell'orario (${block.title}).`;
  } else {
    const external = await prisma.externalCalendarEvent.findFirst({ where: { tenantId, ...overlap }, select: { id: true } });
    if (external) return "In quell'orario c'è un evento nel calendario collegato.";
  }

  return null;
}
