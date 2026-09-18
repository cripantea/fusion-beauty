"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export type StatsPeriod = "today" | "yesterday" | "week" | "month" | "quarter" | "year";

function getPeriodRange(period: StatsPeriod): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  switch (period) {
    case "today":
      return { start: today, end: endOfToday };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yEnd = new Date(y);
      yEnd.setHours(23, 59, 59, 999);
      return { start: y, end: yEnd };
    }
    case "week": {
      const start = new Date(today);
      const day = today.getDay();
      start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return { start, end: endOfToday };
    }
    case "month": {
      const start = new Date(today);
      start.setDate(1);
      return { start, end: endOfToday };
    }
    case "quarter": {
      const start = new Date(today);
      start.setDate(1);
      const currentMonth = today.getMonth();
      const quarterMonth = Math.floor(currentMonth / 3) * 3;
      start.setMonth(quarterMonth);
      return { start, end: endOfToday };
    }
    case "year": {
      const start = new Date(today);
      start.setMonth(0, 1);
      return { start, end: endOfToday };
    }
  }
}

export type StatsKPIs = {
  revenue: number;
  appointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  avgTicket: number;
  newClients: number;
  returningClients: number;
  inactiveClients: number;
  productsSold: number;
  productsRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  transferRevenue: number;
  revenueByOperator: Array<{ name: string; revenue: number; appointments: number }>;
  revenueByService: Array<{ name: string; revenue: number; count: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; appointments: number }>;
  topClients: Array<{ name: string; spent: number; visits: number }>;
};

export async function getStats(period: StatsPeriod): Promise<StatsKPIs> {
  const { tenantId } = await getTenantContext();
  const { start, end } = getPeriodRange(period);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [payments, appointments, newClients, productSales, allClients] = await Promise.all([
    prisma.payment.findMany({
      where: { tenantId, paidAt: { gte: start, lte: end } },
      include: {
        appointment: {
          include: {
            operator: { select: { firstName: true, lastName: true } },
            service: { select: { name: true } },
          },
        },
        client: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { tenantId, startTime: { gte: start, lte: end } },
      include: {
        service: { select: { name: true, price: true } },
        operator: { select: { firstName: true, lastName: true } },
        payment: { select: { amount: true } },
        client: { select: { id: true } },
      },
    }),
    prisma.client.count({ where: { tenantId, createdAt: { gte: start, lte: end } } }),
    prisma.productSale.findMany({
      where: { tenantId, soldAt: { gte: start, lte: end } },
      include: { product: { select: { name: true } } },
    }),
    prisma.client.findMany({
      where: { tenantId },
      select: { id: true },
    }),
  ]);

  const revenue = payments.reduce((s, p) => s + p.amount.toNumber(), 0);
  const totalAppts = appointments.length;
  const completedAppts = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelledAppts = appointments.filter((a) => a.status === "CANCELLED").length;
  const noShowAppts = appointments.filter((a) => a.status === "NO_SHOW").length;
  const avgTicket = completedAppts > 0 ? revenue / completedAppts : 0;

  // Returning vs new clients in period
  const clientsWithAppts = new Set(appointments.map((a) => a.client.id));
  const returningClients = await prisma.appointment.groupBy({
    by: ["clientId"],
    where: {
      tenantId,
      startTime: { lt: start },
      status: "COMPLETED",
      clientId: { in: Array.from(clientsWithAppts) },
    },
  });
  const returningClientCount = returningClients.length;

  // Inactive clients
  const activeClientIds = await prisma.appointment.findMany({
    where: { tenantId, startTime: { gte: ninetyDaysAgo }, status: { not: "CANCELLED" } },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  const activeSet = new Set(activeClientIds.map((a) => a.clientId));
  const inactiveClients = allClients.filter((c) => !activeSet.has(c.id)).length;

  // Cash / card / transfer
  const cashRevenue = payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount.toNumber(), 0);
  const cardRevenue = payments.filter((p) => p.method === "CARD").reduce((s, p) => s + p.amount.toNumber(), 0);
  const transferRevenue = payments.filter((p) => p.method === "TRANSFER").reduce((s, p) => s + p.amount.toNumber(), 0);

  // Revenue by operator
  const operatorMap = new Map<string, { revenue: number; appointments: number }>();
  for (const p of payments) {
    if (p.appointment?.operator) {
      const name = `${p.appointment.operator.firstName} ${p.appointment.operator.lastName}`;
      const existing = operatorMap.get(name) ?? { revenue: 0, appointments: 0 };
      operatorMap.set(name, { revenue: existing.revenue + p.amount.toNumber(), appointments: existing.appointments + 1 });
    }
  }
  const revenueByOperator = Array.from(operatorMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  // Revenue by service
  const serviceMap = new Map<string, { revenue: number; count: number }>();
  for (const a of appointments) {
    if (a.status === "COMPLETED" && a.payment) {
      const name = a.service.name;
      const existing = serviceMap.get(name) ?? { revenue: 0, count: 0 };
      serviceMap.set(name, { revenue: existing.revenue + a.payment.amount.toNumber(), count: existing.count + 1 });
    }
  }
  const revenueByService = Array.from(serviceMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Daily revenue (last 30 days or current period)
  const dailyMap = new Map<string, { revenue: number; appointments: number }>();
  for (const p of payments) {
    const dateKey = p.paidAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(dateKey) ?? { revenue: 0, appointments: 0 };
    dailyMap.set(dateKey, { revenue: existing.revenue + p.amount.toNumber(), appointments: existing.appointments + 1 });
  }
  const dailyRevenue = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top clients by revenue
  const clientMap = new Map<string, { name: string; spent: number; visits: number }>();
  for (const p of payments) {
    const name = `${p.client.firstName} ${p.client.lastName}`;
    const existing = clientMap.get(name) ?? { name, spent: 0, visits: 0 };
    clientMap.set(name, { ...existing, spent: existing.spent + p.amount.toNumber(), visits: existing.visits + 1 });
  }
  const topClients = Array.from(clientMap.values())
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  // Product sales
  const productsSold = productSales.reduce((s, ps) => s + ps.quantity, 0);
  const productsRevenue = productSales.reduce((s, ps) => s + ps.unitPrice.toNumber() * ps.quantity, 0);

  return {
    revenue,
    appointments: totalAppts,
    completedAppointments: completedAppts,
    cancelledAppointments: cancelledAppts,
    noShowAppointments: noShowAppts,
    avgTicket,
    newClients,
    returningClients: returningClientCount,
    inactiveClients,
    productsSold,
    productsRevenue,
    cashRevenue,
    cardRevenue,
    transferRevenue,
    revenueByOperator,
    revenueByService,
    dailyRevenue,
    topClients,
  };
}
