import "server-only";

import { getRangeMetrics, type RangeMetrics } from "@/lib/stats";
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

  const [metrics, appointments] = await Promise.all([
    getRangeMetrics(tenantId, range),
    prisma.appointment.findMany({
      where: { tenantId, status: "COMPLETED", startTime: { gte: range.start, lt: range.end } },
      select: {
        service: { select: { id: true, name: true } },
        operator: { select: { id: true, firstName: true, lastName: true } },
        payment: { select: { amount: true } },
      },
    }),
  ]);

  const services = new Map<string, { name: string; count: number; revenue: number }>();
  const operators = new Map<string, { name: string; appointments: number; revenue: number }>();

  for (const appointment of appointments) {
    const revenue = appointment.payment?.amount.toNumber() ?? 0;

    const service = services.get(appointment.service.id) ?? {
      name: appointment.service.name,
      count: 0,
      revenue: 0,
    };
    service.count += 1;
    service.revenue += revenue;
    services.set(appointment.service.id, service);

    const operatorKey = appointment.operator?.id ?? "none";
    const operator = operators.get(operatorKey) ?? {
      name: appointment.operator
        ? `${appointment.operator.firstName} ${appointment.operator.lastName}`
        : "Senza operatrice",
      appointments: 0,
      revenue: 0,
    };
    operator.appointments += 1;
    operator.revenue += revenue;
    operators.set(operatorKey, operator);
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
