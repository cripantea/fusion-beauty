/**
 * Un appuntamento può avere più trattamenti (es. Manicure + Pedicure): il primo è
 * `Appointment.serviceId`, gli altri stanno in `AppointmentExtraService` in ordine.
 * Si fanno uno dopo l'altro e ognuno può avere la sua operatrice: quella del primo è
 * `Appointment.operatorId`, per gli altri `AppointmentExtraService.operatorId` (vuoto = la stessa).
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

/** Un trattamento dell'appuntamento con chi lo fa. */
export type TreatmentPart = { name: string; durationMinutes: number; operatorId: string | null };

/** Tratto di appuntamento che occupa l'agenda di un'operatrice. */
export type OperatorBlock = { operatorId: string | null; startTime: Date; endTime: Date; names: string[] };

/** Riga Prisma → trattamenti in ordine, ognuno con la sua operatrice. */
export function appointmentParts(appointment: {
  operatorId: string | null;
  service: { name?: string; durationMinutes: number };
  extraServices?: { durationMinutes: number; operatorId: string | null; service?: { name: string } }[];
}): TreatmentPart[] {
  return [
    { name: appointment.service.name ?? "", durationMinutes: appointment.service.durationMinutes, operatorId: appointment.operatorId },
    ...(appointment.extraServices ?? []).map((extra) => ({
      name: extra.service?.name ?? "",
      durationMinutes: extra.durationMinutes,
      operatorId: extra.operatorId ?? appointment.operatorId,
    })),
  ];
}

/**
 * Chi è occupata e quando: i trattamenti si fanno di seguito dall'inizio dell'appuntamento,
 * quelli vicini della stessa operatrice fanno un tratto solo. L'ultimo arriva alla fine
 * dell'appuntamento (la durata totale si può cambiare a mano).
 */
export function operatorBlocks(startTime: Date, endTime: Date, parts: TreatmentPart[]): OperatorBlock[] {
  const blocks: OperatorBlock[] = [];
  const end = endTime.getTime();
  let cursor = startTime.getTime();
  parts.forEach((part, index) => {
    const from = Math.min(cursor, end);
    const to = index === parts.length - 1 ? end : Math.min(from + part.durationMinutes * 60000, end);
    cursor = to;
    const last = blocks[blocks.length - 1];
    if (last && last.operatorId === part.operatorId) {
      last.endTime = new Date(to);
      last.names.push(part.name);
    } else if (to > from || blocks.length === 0) {
      blocks.push({ operatorId: part.operatorId, startTime: new Date(from), endTime: new Date(to), names: [part.name] });
    }
  });
  return blocks;
}
