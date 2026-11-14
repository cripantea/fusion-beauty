import "server-only";

import { getRangeMetrics, type RangeMetrics } from "@/lib/stats";
import { appointmentTotalPrice, extraServicesSelect } from "@/lib/appointment-services";
import { isPaymentsEnabled } from "@/lib/payments-mode";
import { prisma } from "@/lib/prisma";

export function parseMonth(value: string | undefined, now = new Date()) {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
  };
}

export type MonthlyReport = {
  key: string;
  start: Date;
  metrics: RangeMetrics;
  topService: { name: string; count: number; revenue: number } | null;
  operators: { name: string; appointments: number; revenue: number }[];
};

export async function getMonthlyReport(tenantId: string, monthParam?: string): Promise<MonthlyReport> {
  const month = parseMonth(monthParam);
  const range = { start: month.start, end: month.end };

  const [metrics, appointments, paymentsEnabled] = await Promise.all([
    getRangeMetrics(tenantId, range),
    prisma.appointment.findMany({
      where: { tenantId, status: "COMPLETED", startTime: { gte: range.start, lt: range.end } },
      select: {
        service: { select: { id: true, name: true, price: true } },
        extraServices: extraServicesSelect,
        operator: { select: { id: true, firstName: true, lastName: true } },
        payment: { select: { amount: true } },
        // Prezzo di listino per l'incasso stimato (senza incassi in cassa)
      },
    }),
    isPaymentsEnabled(tenantId),
  ]);

  const services = new Map<string, { name: string; count: number; revenue: number }>();
  const operators = new Map<string, { name: string; appointments: number; revenue: number }>();

  for (const appointment of appointments) {
    const listPrice = appointmentTotalPrice(appointment);
    const revenue = paymentsEnabled ? (appointment.payment?.amount.toNumber() ?? 0) : listPrice;

    // Ogni trattamento dell'appuntamento conta; l'incasso si divide in proporzione al listino.
    const treatments = [
      { id: appointment.service.id, name: appointment.service.name, price: appointment.service.price.toNumber(), operator: appointment.operator },
      ...appointment.extraServices.map((extra) => ({
        id: extra.service.id,
        name: extra.service.name,
        price: extra.price.toNumber(),
        operator: extra.operator ?? appointment.operator,
      })),
    ];
    // Ogni operatrice conta l'appuntamento una volta e incassa la parte dei suoi trattamenti.
    const counted = new Set<string>();
    for (const treatment of treatments) {
      const share = listPrice > 0 ? (revenue * treatment.price) / listPrice : revenue / treatments.length;
      const service = services.get(treatment.id) ?? { name: treatment.name, count: 0, revenue: 0 };
      service.count += 1;
      service.revenue += share;
      services.set(treatment.id, service);

      const operatorKey = treatment.operator?.id ?? "none";
      const operator = operators.get(operatorKey) ?? {
        name: treatment.operator ? `${treatment.operator.firstName} ${treatment.operator.lastName}` : "Senza operatrice",
        appointments: 0,
        revenue: 0,
      };
      if (!counted.has(operatorKey)) operator.appointments += 1;
      counted.add(operatorKey);
      operator.revenue += share;
      operators.set(operatorKey, operator);
    }
  }

  const topService = [...services.values()].sort((a, b) => b.count - a.count || b.revenue - a.revenue)[0] ?? null;

  return {
    key: month.key,
    start: month.start,
    metrics,
    topService,
    operators: [...operators.values()].sort((a, b) => b.revenue - a.revenue),
  };
}
