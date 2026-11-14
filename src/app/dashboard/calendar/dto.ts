import type { Prisma } from "@/generated/prisma/client";
import { appointmentParts, blocksOf, extraServicesSelect, treatmentTimes } from "@/lib/appointment-services";

import type { AppointmentStatusValue } from "./schema";

export type PaymentMethodValue = "CASH" | "CARD" | "TRANSFER" | "OTHER";

type OperatorRef = { id: string; firstName: string; lastName: string };

export type AppointmentDTO = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatusValue;
  source: "INTERNAL" | "ONLINE";
  notes: string | null;
  client: { id: string; firstName: string; lastName: string; phone: string };
  /** Trattamento principale (il primo). */
  service: { id: string; name: string; durationMinutes: number; price: number };
  /** Tutti i trattamenti dell'appuntamento, il principale per primo (es. Manicure + Pedicure). */
  services: {
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
    operator: OperatorRef | null;
    /** Quando si fa questo trattamento (solo per l'agenda interna). */
    startTime: Date;
    endTime: Date;
  }[];
  /** Operatrice del primo trattamento (gli altri possono averne un'altra: vedi `services`). */
  operator: OperatorRef | null;
  payment: { amount: number; method: PaymentMethodValue; notes: string | null } | null;
  /** Ultimo link di pagamento online (Stripe) non annullato. */
  paymentLink: { status: "PENDING" | "PAID" | "CANCELLED"; amountCents: number; token: string; paidWith: string | null } | null;
  /** Manca un consenso richiesto dal trattamento (es. laser): calcolato solo per agenda e "Oggi". */
  consentMissing?: boolean;
};

export const appointmentInclude = {
  client: { select: { id: true, firstName: true, lastName: true, phone: true } },
  service: { select: { id: true, name: true, durationMinutes: true, price: true } },
  extraServices: extraServicesSelect,
  operator: { select: { id: true, firstName: true, lastName: true } },
  payment: { select: { amount: true, method: true, notes: true } },
  paymentLinks: {
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { status: true, amountCents: true, token: true, paidWith: true },
  },
} satisfies Prisma.AppointmentInclude;

export type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

export function toAppointmentDTO(appointment: AppointmentRow): AppointmentDTO {
  const times = treatmentTimes(appointment.startTime, appointment.endTime, appointmentParts(appointment));
  const when = (index: number) => ({ startTime: new Date(times[index].from), endTime: new Date(times[index].to) });
  const service = { ...appointment.service, price: appointment.service.price.toNumber() };
  return {
    id: appointment.id,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    source: appointment.source,
    notes: appointment.notes,
    client: appointment.client,
    service,
    services: [
      { ...service, operator: appointment.operator, ...when(0) },
      ...appointment.extraServices.map((extra, index) => ({
        id: extra.service.id,
        name: extra.service.name,
        durationMinutes: extra.durationMinutes,
        price: extra.price.toNumber(),
        operator: extra.operator ?? appointment.operator,
        ...when(index + 1),
      })),
    ],
    operator: appointment.operator,
    payment: appointment.payment
      ? { amount: appointment.payment.amount.toNumber(), method: appointment.payment.method, notes: appointment.payment.notes }
      : null,
    paymentLink: appointment.paymentLinks[0] ?? null,
  };
}

/** Tratti dell'appuntamento per operatrice (colonne dell'agenda). */
export function appointmentBlocks(appointment: AppointmentDTO) {
  return blocksOf(
    appointment.services.map((service) => ({
      operatorId: service.operator?.id ?? null,
      name: service.name,
      from: service.startTime.getTime(),
      to: service.endTime.getTime(),
    }))
  );
}
