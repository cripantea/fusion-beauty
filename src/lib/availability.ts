import { appointmentParts, operatorBlocks, type TreatmentPart } from "@/lib/appointment-services";
import { prisma } from "@/lib/prisma";
import { romeParts } from "@/lib/rome-time";

const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * L'operatrice quel giorno (ora italiana) non lavora, o non in quella fascia.
 * Imprevisto del giorno prima degli orari settimanali; senza orari impostati non si controlla.
 */
async function outsideWorkingHours(tenantId: string, operatorId: string, start: Date, end: Date): Promise<string | null> {
  const operator = await prisma.user.findFirst({
    where: { id: operatorId, tenantId },
    select: { firstName: true, workingHours: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } } },
  });
  if (!operator || operator.workingHours.length === 0) return null;

  const from = romeParts(start);
  const to = romeParts(new Date(end.getTime() - 1));
  const day = `${from.year}-${pad(from.month)}-${pad(from.day)}`;
  const dow = ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1=lun … 7=dom
  const exception = await prisma.staffException.findFirst({
    where: { tenantId, userId: operatorId, date: new Date(`${day}T00:00:00Z`) },
    select: { startTime: true, endTime: true },
  });

  const shifts = exception
    ? exception.startTime && exception.endTime
      ? [{ start: toMinutes(exception.startTime), end: toMinutes(exception.endTime) }]
      : []
    : operator.workingHours.filter((h) => h.dayOfWeek === dow).map((h) => ({ start: toMinutes(h.startTime), end: toMinutes(h.endTime) }));

  if (shifts.length === 0) return `${operator.firstName} quel giorno non lavora.`;
  const startMin = from.hour * 60 + from.minute;
  const endMin = to.day === from.day ? to.hour * 60 + to.minute + 1 : 24 * 60;
  if (shifts.some((shift) => startMin >= shift.start && endMin <= shift.end)) return null;
  const hours = shifts.map((shift) => `${toHHMM(shift.start)}–${toHHMM(shift.end)}`).join(", ");
  return `${operator.firstName} quel giorno lavora solo ${hours}.`;
}

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

  // Appuntamenti in cui l'operatrice fa almeno un trattamento: conta solo il suo tratto.
  const candidates = await prisma.appointment.findMany({
    where: {
      tenantId,
      ...(operatorId ? { OR: [{ operatorId }, { extraServices: { some: { operatorId } } }] } : { operatorId: null }),
      status: { in: ["BOOKED", "CONFIRMED"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      ...overlap,
    },
    select: {
      client: { select: { firstName: true, lastName: true } },
      startTime: true,
      endTime: true,
      operatorId: true,
      service: { select: { durationMinutes: true } },
      extraServices: { orderBy: { position: "asc" }, select: { durationMinutes: true, operatorId: true, startTime: true } },
    },
  });
  const appointment = candidates.find((candidate) =>
    operatorBlocks(candidate.startTime, candidate.endTime, appointmentParts(candidate)).some(
      (block) => block.operatorId === operatorId && block.startTime < end && block.endTime > start
    )
  );
  if (appointment) {
    const who = `${appointment.client.firstName} ${appointment.client.lastName}`.trim();
    if (!operatorId) return `In quell'orario c'è già un appuntamento senza operatrice (${who}).`;
    const operator = await prisma.user.findFirst({ where: { id: operatorId, tenantId }, select: { firstName: true } });
    return `${operator?.firstName ?? "L'operatrice"} ha già un appuntamento in quell'orario (${who}).`;
  }

  if (operatorId) {
    const outside = await outsideWorkingHours(tenantId, operatorId, start, end);
    if (outside) return outside;
    const block = await prisma.staffBlock.findFirst({ where: { tenantId, userId: operatorId, ...overlap }, select: { title: true } });
    if (block) {
      const operator = await prisma.user.findFirst({ where: { id: operatorId, tenantId }, select: { firstName: true } });
      return `${operator?.firstName ?? "L'operatrice"} ha un impegno in quell'orario (${block.title}).`;
    }
  } else {
    const external = await prisma.externalCalendarEvent.findFirst({ where: { tenantId, ...overlap }, select: { id: true } });
    if (external) return "In quell'orario c'è un evento nel calendario collegato.";
  }

  return null;
}

/**
 * Come findClash, per un appuntamento con più trattamenti: ogni operatrice
 * deve essere libera nel suo tratto (i trattamenti si fanno uno dopo l'altro).
 */
export async function findClashForParts(
  tenantId: string,
  input: { start: Date; end: Date; parts: TreatmentPart[]; excludeAppointmentId?: string }
): Promise<string | null> {
  for (const block of operatorBlocks(input.start, input.end, input.parts)) {
    const clash = await findClash(tenantId, {
      operatorId: block.operatorId,
      start: block.startTime,
      end: block.endTime,
      excludeAppointmentId: input.excludeAppointmentId,
    });
    if (clash) return clash;
  }
  return null;
}
