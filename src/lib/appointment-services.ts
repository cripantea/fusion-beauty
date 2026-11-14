/**
 * Un appuntamento può avere più trattamenti (es. Manicure + Pedicure): il primo è
 * `Appointment.serviceId`, gli altri stanno in `AppointmentExtraService` in ordine.
 * Ognuno può avere la sua operatrice e il suo orario (scelto a mano, solo per l'agenda interna):
 * il primo è quello che inizia prima, con `Appointment.operatorId` e `Appointment.startTime`;
 * per gli altri `AppointmentExtraService.operatorId` (vuoto = la stessa) e `.startTime`
 * (vuoto = subito dopo il precedente, come negli appuntamenti vecchi).
 * Questi aiuti valgono sia per le righe Prisma sia per l'AppointmentDTO dell'agenda.
 */

type PriceLike = number | string | { toNumber(): number };

/** Da mettere nell'include/select di Prisma: `extraServices: extraServicesSelect`. */
export const extraServicesSelect = {
  orderBy: { position: "asc" },
  select: {
    serviceId: true,
    price: true,
    durationMinutes: true,
    operatorId: true,
    startTime: true,
    service: { select: { id: true, name: true } },
    operator: { select: { id: true, firstName: true, lastName: true } },
  },
} as const;

type ServiceItem = { name: string; price?: PriceLike };

/** Riga Prisma (trattamento principale + extra) oppure DTO con `services` già pronti. */
export type AppointmentWithServices =
  | { services: ServiceItem[] }
  | {
      service: ServiceItem;
      extraServices?: { price?: PriceLike; service: { name: string } }[];
    };

function toNumber(value: PriceLike | undefined) {
  if (value === undefined) return 0;
  return typeof value === "object" ? value.toNumber() : Number(value);
}

function serviceList(appointment: AppointmentWithServices): ServiceItem[] {
  if ("services" in appointment) return appointment.services;
  return [
    appointment.service,
    ...(appointment.extraServices ?? []).map((extra) => ({ name: extra.service.name, price: extra.price })),
  ];
}

/** "Manicure + Pedicure" */
export function appointmentServiceNames(appointment: AppointmentWithServices) {
  return serviceList(appointment)
    .map((service) => service.name)
    .join(" + ");
}

/** Prezzo di listino di tutti i trattamenti (il principale al prezzo attuale, gli altri a quello della prenotazione). */
export function appointmentTotalPrice(appointment: AppointmentWithServices) {
  const cents = serviceList(appointment).reduce((sum, service) => sum + Math.round(toNumber(service.price) * 100), 0);
  return cents / 100;
}

/** Tutti i trattamenti dell'appuntamento, il principale per primo. */
export function appointmentServiceIds(appointment: { serviceId: string; extraServices?: { serviceId: string }[] }) {
  return [appointment.serviceId, ...(appointment.extraServices ?? []).map((extra) => extra.serviceId)];
}

type OperatorLike = { firstName: string; lastName?: string } | null | undefined;

/** "Roberta" oppure "Roberta e Giulia" se i trattamenti li fanno operatrici diverse (`full`: con il cognome). */
export function appointmentOperatorNames(
  appointment:
    | { services: { operator?: OperatorLike }[] }
    | { operator?: OperatorLike; extraServices?: { operator?: OperatorLike }[] },
  options: { full?: boolean } = {}
) {
  const operators =
    "services" in appointment
      ? appointment.services.map((service) => service.operator)
      : [appointment.operator, ...(appointment.extraServices ?? []).map((extra) => extra.operator ?? appointment.operator)];
  const names = operators
    .filter((operator) => operator != null)
    .map((operator) => (options.full && operator.lastName ? `${operator.firstName} ${operator.lastName}` : operator.firstName));
  return [...new Set(names)].join(" e ");
}

/** Un trattamento dell'appuntamento con chi lo fa e, se scelto a mano, quando. */
export type TreatmentPart = { name: string; durationMinutes: number; operatorId: string | null; startTime?: Date | null };

/** Tratto di appuntamento che occupa l'agenda di un'operatrice. */
export type OperatorBlock = { operatorId: string | null; startTime: Date; endTime: Date; names: string[] };

/** Riga Prisma → trattamenti in ordine, ognuno con la sua operatrice e il suo orario. */
export function appointmentParts(appointment: {
  operatorId: string | null;
  service: { name?: string; durationMinutes: number };
  extraServices?: { durationMinutes: number; operatorId: string | null; startTime?: Date | null; service?: { name: string } }[];
}): TreatmentPart[] {
  return [
    { name: appointment.service.name ?? "", durationMinutes: appointment.service.durationMinutes, operatorId: appointment.operatorId },
    ...(appointment.extraServices ?? []).map((extra) => ({
      name: extra.service?.name ?? "",
      durationMinutes: extra.durationMinutes,
      operatorId: extra.operatorId ?? appointment.operatorId,
      startTime: extra.startTime ?? null,
    })),
  ];
}

/**
 * Quando si fa ogni trattamento (stesso ordine di `parts`). Con gli orari scelti a mano
 * ognuno dura il suo tempo dal suo orario; senza (appuntamenti vecchi, o uno solo) si fanno
 * di seguito dall'inizio e l'ultimo arriva alla fine dell'appuntamento.
 */
export function treatmentTimes(startTime: Date, endTime: Date, parts: TreatmentPart[]): { from: number; to: number }[] {
  const manual = parts.some((part, index) => index > 0 && part.startTime);
  const end = endTime.getTime();
  let cursor = startTime.getTime();
  return parts.map((part, index) => {
    let from: number;
    let to: number;
    if (manual) {
      from = index === 0 ? startTime.getTime() : (part.startTime?.getTime() ?? cursor);
      to = from + part.durationMinutes * 60000;
    } else {
      from = Math.min(cursor, end);
      to = index === parts.length - 1 ? end : Math.min(from + part.durationMinutes * 60000, end);
    }
    cursor = to;
    return { from, to };
  });
}

/**
 * Chi è occupata e quando: un tratto per trattamento, quelli della stessa operatrice
 * che si toccano fanno un tratto solo.
 */
export function blocksOf(pieces: { operatorId: string | null; name: string; from: number; to: number }[]): OperatorBlock[] {
  const sorted = pieces
    .map((piece, index) => ({ ...piece, index }))
    .filter((piece) => piece.to > piece.from || piece.index === 0)
    .sort((a, b) => a.from - b.from || a.index - b.index);

  const blocks: OperatorBlock[] = [];
  for (const piece of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && last.operatorId === piece.operatorId && piece.from <= last.endTime.getTime()) {
      last.endTime = new Date(Math.max(last.endTime.getTime(), piece.to));
      last.names.push(piece.name);
    } else {
      blocks.push({ operatorId: piece.operatorId, startTime: new Date(piece.from), endTime: new Date(piece.to), names: [piece.name] });
    }
  }
  return blocks;
}

export function operatorBlocks(startTime: Date, endTime: Date, parts: TreatmentPart[]): OperatorBlock[] {
  const times = treatmentTimes(startTime, endTime, parts);
  return blocksOf(parts.map((part, index) => ({ operatorId: part.operatorId, name: part.name, ...times[index] })));
}
