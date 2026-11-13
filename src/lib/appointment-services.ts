/**
 * Un appuntamento può avere più trattamenti (es. Manicure + Pedicure): il primo è
 * `Appointment.serviceId`, gli altri stanno in `AppointmentExtraService` in ordine.
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
    service: { select: { id: true, name: true } },
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
