"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import type { PaymentMethodValue } from "./constants";

export type { PaymentMethodValue };

export type PaymentDTO = {
  id: string;
  clientId: string;
  appointmentId: string | null;
  amount: number;
  method: PaymentMethodValue;
  notes: string | null;
  paidAt: Date;
  client: { firstName: string; lastName: string };
  appointment: { service: { name: string } } | null;
};

export type PaymentActionResult =
  | { success: true; payment: PaymentDTO }
  | { success: false; error: string };

function toPaymentDTO(p: {
  id: string;
  clientId: string;
  appointmentId: string | null;
  amount: { toNumber(): number };
  method: PaymentMethodValue;
  notes: string | null;
  paidAt: Date;
  client: { firstName: string; lastName: string };
  appointment: { service: { name: string } } | null;
}): PaymentDTO {
  return { ...p, amount: p.amount.toNumber() };
}

export async function createPayment(input: {
  appointmentId: string;
  method: PaymentMethodValue;
  amount: number;
  notes?: string;
}): Promise<PaymentActionResult> {
  const { tenantId } = await getTenantContext();

  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, tenantId },
    include: { client: true, service: true },
  });

  if (!appointment) {
    return { success: false, error: "Appuntamento non trovato." };
  }

  const existingPayment = await prisma.payment.findUnique({
    where: { appointmentId: input.appointmentId },
  });

  if (existingPayment) {
    return { success: false, error: "Questo appuntamento è già stato pagato." };
  }

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        tenantId,
        clientId: appointment.clientId,
        appointmentId: input.appointmentId,
        amount: input.amount,
        method: input.method,
        notes: input.notes?.trim() || null,
        paidAt: new Date(),
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
        appointment: { include: { service: { select: { name: true } } } },
      },
    }),
    prisma.appointment.update({
      where: { id: input.appointmentId },
      data: { status: "COMPLETED" },
    }),
  ]);

  return { success: true, payment: toPaymentDTO(payment) };
}

export async function getPaymentsByClient(clientId: string): Promise<PaymentDTO[]> {
  const { tenantId } = await getTenantContext();

  const payments = await prisma.payment.findMany({
    where: { tenantId, clientId },
    orderBy: { paidAt: "desc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      appointment: { include: { service: { select: { name: true } } } },
    },
  });

  return payments.map(toPaymentDTO);
}

export async function getTodayPayments(): Promise<PaymentDTO[]> {
  const { tenantId } = await getTenantContext();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const payments = await prisma.payment.findMany({
    where: { tenantId, paidAt: { gte: start, lte: end } },
    orderBy: { paidAt: "desc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      appointment: { include: { service: { select: { name: true } } } },
    },
  });

  return payments.map(toPaymentDTO);
}

export type TodayPaymentSummary = {
  total: number;
  cash: number;
  card: number;
  transfer: number;
  other: number;
  count: number;
};

export async function getTodayPaymentSummary(): Promise<TodayPaymentSummary> {
  const payments = await getTodayPayments();
  return {
    total: payments.reduce((s, p) => s + p.amount, 0),
    cash: payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0),
    card: payments.filter((p) => p.method === "CARD").reduce((s, p) => s + p.amount, 0),
    transfer: payments.filter((p) => p.method === "TRANSFER").reduce((s, p) => s + p.amount, 0),
    other: payments.filter((p) => p.method === "OTHER").reduce((s, p) => s + p.amount, 0),
    count: payments.length,
  };
}
