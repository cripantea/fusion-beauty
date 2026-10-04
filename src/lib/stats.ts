import "server-only";

import { prisma } from "@/lib/prisma";

export type StatsPeriod = "day" | "week" | "month" | "year";

export const STATS_PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "day", label: "Oggi" },
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
  { value: "year", label: "Anno" },
];

export function parsePeriod(value: string | undefined): StatsPeriod {
  return value === "day" || value === "week" || value === "year" ? value : "month";
}

export type DateRange = { start: Date; end: Date };

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Intervalli [start, end) del periodo corrente e di quello precedente. */
export function getPeriodRanges(period: StatsPeriod, now = new Date()) {
  const today = startOfDay(now);
  let start: Date;
  let end: Date;
  let prevStart: Date;

  if (period === "day") {
    start = today;
    end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    prevStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  } else if (period === "week") {
    const offset = (today.getDay() + 6) % 7; // lunedì = 0
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    prevStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
  } else if (period === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  } else {
    start = new Date(today.getFullYear(), 0, 1);
    end = new Date(today.getFullYear() + 1, 0, 1);
    prevStart = new Date(today.getFullYear() - 1, 0, 1);
  }

  return { current: { start, end }, previous: { start: prevStart, end: start } };
}

export type RangeMetrics = {
  revenue: number;
  paymentsCount: number;
  completedAppointments: number;
  newClients: number;
  /** Quota di clienti servite nel periodo che erano già state servite prima. */
  returningRate: number | null;
  servedClients: number;
};

export async function getRangeMetrics(tenantId: string, range: DateRange): Promise<RangeMetrics> {
  const [payments, completed, newClients] = await Promise.all([
    prisma.payment.aggregate({
      where: { tenantId, paidAt: { gte: range.start, lt: range.end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.appointment.findMany({
      where: { tenantId, status: "COMPLETED", startTime: { gte: range.start, lt: range.end } },
      select: { clientId: true },
    }),
    prisma.client.count({ where: { tenantId, createdAt: { gte: range.start, lt: range.end } } }),
  ]);

  const servedIds = [...new Set(completed.map((appointment) => appointment.clientId))];
  let returningRate: number | null = null;
  if (servedIds.length > 0) {
    const before = await prisma.appointment.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        clientId: { in: servedIds },
        startTime: { lt: range.start },
      },
      select: { clientId: true },
      distinct: ["clientId"],
    });
    returningRate = Math.round((before.length / servedIds.length) * 100);
  }

  return {
    revenue: payments._sum.amount?.toNumber() ?? 0,
    paymentsCount: payments._count._all,
    completedAppointments: completed.length,
    newClients,
    returningRate,
    servedClients: servedIds.length,
  };
}

export type RevenueBar = { label: string; value: number };

const monthLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const dayLabels = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export async function getRevenueBars(
  tenantId: string,
  period: StatsPeriod,
  range: DateRange
): Promise<RevenueBar[]> {
  const payments = await prisma.payment.findMany({
    where: { tenantId, paidAt: { gte: range.start, lt: range.end } },
    select: { paidAt: true, amount: true },
  });

  let bars: RevenueBar[];
  let indexOf: (date: Date) => number;

  if (period === "day") {
    bars = Array.from({ length: 13 }, (_, i) => ({ label: `${8 + i}`, value: 0 }));
    indexOf = (date) => Math.min(Math.max(date.getHours() - 8, 0), 12);
  } else if (period === "week") {
    bars = dayLabels.map((label) => ({ label, value: 0 }));
    indexOf = (date) => (date.getDay() + 6) % 7;
  } else if (period === "month") {
    const weeks = Math.ceil((new Date(range.end.getTime() - 1).getDate()) / 7);
    bars = Array.from({ length: weeks }, (_, i) => ({ label: `Sett. ${i + 1}`, value: 0 }));
    indexOf = (date) => Math.min(Math.floor((date.getDate() - 1) / 7), weeks - 1);
  } else {
    bars = monthLabels.map((label) => ({ label, value: 0 }));
    indexOf = (date) => date.getMonth();
  }

  for (const payment of payments) {
    bars[indexOf(payment.paidAt)].value += payment.amount.toNumber();
  }
  return bars.map((bar) => ({ ...bar, value: Math.round(bar.value * 100) / 100 }));
}

export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
