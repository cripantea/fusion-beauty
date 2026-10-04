import type { Prisma } from "@/generated/prisma/client";

import type { AppointmentStatusValue } from "./schema";

export type PaymentMethodValue = "CASH" | "CARD" | "TRANSFER" | "OTHER";

export type AppointmentDTO = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatusValue;
  source: "INTERNAL" | "ONLINE";
  notes: string | null;
  client: { id: string; firstName: string; lastName: string; phone: string };
  service: { id: string; name: string; durationMinutes: number; price: number };
  operator: { id: string; firstName: string; lastName: string } | null;
  payment: { amount: number; method: PaymentMethodValue } | null;
};

export const appointmentInclude = {
  client: { select: { id: true, firstName: true, lastName: true, phone: true } },
  service: { select: { id: true, name: true, durationMinutes: true, price: true } },
  operator: { select: { id: true, firstName: true, lastName: true } },
  payment: { select: { amount: true, method: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

export function toAppointmentDTO(appointment: AppointmentRow): AppointmentDTO {
  return {
    id: appointment.id,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    source: appointment.source,
    notes: appointment.notes,
    client: appointment.client,
    service: { ...appointment.service, price: appointment.service.price.toNumber() },
    operator: appointment.operator,
    payment: appointment.payment
      ? { amount: appointment.payment.amount.toNumber(), method: appointment.payment.method }
      : null,
  };
}
