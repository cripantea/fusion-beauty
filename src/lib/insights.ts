import "server-only";

import { prisma } from "@/lib/prisma";

export const LOYAL_MIN_VISITS = 5;
export const INACTIVE_MONTHS = 6;

export type ClientStats = {
  visits: number;
  totalSpent: number;
  /** Ultimo trattamento completato. */
  lastVisit: Date | null;
};

export function isLoyal(visits: number) {
  return visits >= LOYAL_MIN_VISITS;
}

/** Statistiche per cliente (trattamenti completati + totale incassato) in due query aggregate. */
export async function getClientStatsMap(tenantId: string, clientIds?: string[]) {
  const clientFilter = clientIds ? { clientId: { in: clientIds } } : {};

  const [visitGroups, spendGroups] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { tenantId, status: "COMPLETED", ...clientFilter },
      _count: { _all: true },
      _max: { startTime: true },
    }),
    prisma.payment.groupBy({
      by: ["clientId"],
      where: { tenantId, ...clientFilter },
      _sum: { amount: true },
    }),
  ]);

  const map = new Map<string, ClientStats>();
  for (const group of visitGroups) {
    map.set(group.clientId, {
      visits: group._count._all,
      totalSpent: 0,
      lastVisit: group._max.startTime,
    });
  }
  for (const group of spendGroups) {
    const current = map.get(group.clientId) ?? { visits: 0, totalSpent: 0, lastVisit: null };
    current.totalSpent = group._sum.amount?.toNumber() ?? 0;
    map.set(group.clientId, current);
  }
  return map;
}

export function emptyStats(): ClientStats {
  return { visits: 0, totalSpent: 0, lastVisit: null };
}

export function monthsAgoDate(months: number, from = new Date()) {
  const date = new Date(from);
  date.setMonth(date.getMonth() - months);
  return date;
}

export type InactiveClient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  lastVisit: Date;
  visits: number;
  lastServiceName: string | null;
};

/** Clienti con almeno un trattamento, ultimo completato oltre `months` mesi fa e nessun appuntamento futuro. */
export async function getInactiveClients(
  tenantId: string,
  months = INACTIVE_MONTHS
): Promise<InactiveClient[]> {
  const cutoff = monthsAgoDate(months);
  const now = new Date();

  const stale = await prisma.appointment.groupBy({
    by: ["clientId"],
    where: { tenantId, status: "COMPLETED" },
    _count: { _all: true },
    _max: { startTime: true },
    having: { startTime: { _max: { lt: cutoff } } },
  });
  if (stale.length === 0) return [];

  const ids = stale.map((group) => group.clientId);
  const [clients, upcoming] = await Promise.all([
    prisma.client.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        clientId: { in: ids },
        startTime: { gte: now },
        status: { in: ["BOOKED", "CONFIRMED"] },
      },
      select: { clientId: true },
    }),
  ]);
  const withUpcoming = new Set(upcoming.map((appointment) => appointment.clientId));
  const clientById = new Map(clients.map((client) => [client.id, client]));

  const lastServices = await prisma.appointment.findMany({
    where: {
      tenantId,
      status: "COMPLETED",
      OR: stale.map((group) => ({ clientId: group.clientId, startTime: group._max.startTime! })),
    },
    select: { clientId: true, service: { select: { name: true } } },
  });
  const serviceByClient = new Map(lastServices.map((row) => [row.clientId, row.service.name]));

  return stale
    .filter((group) => !withUpcoming.has(group.clientId) && clientById.has(group.clientId))
    .map((group) => ({
      ...clientById.get(group.clientId)!,
      lastVisit: group._max.startTime!,
      visits: group._count._all,
      lastServiceName: serviceByClient.get(group.clientId) ?? null,
    }))
    .sort((a, b) => a.lastVisit.getTime() - b.lastVisit.getTime());
}

export type BirthdayClient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  /** Giorni da oggi (0 = oggi). */
  inDays: number;
  day: number;
  month: number;
};

export async function getUpcomingBirthdays(tenantId: string, withinDays = 7): Promise<BirthdayClient[]> {
  const clients = await prisma.client.findMany({
    where: { tenantId, dateOfBirth: { not: null } },
    select: { id: true, firstName: true, lastName: true, phone: true, dateOfBirth: true },
  });

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  const result: BirthdayClient[] = [];
  for (const client of clients) {
    const dob = client.dateOfBirth!;
    const month = dob.getUTCMonth();
    const day = dob.getUTCDate();
    let next = Date.UTC(today.getFullYear(), month, day);
    if (next < todayUtc) next = Date.UTC(today.getFullYear() + 1, month, day);
    const inDays = Math.round((next - todayUtc) / 86_400_000);
    if (inDays <= withinDays) {
      result.push({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        inDays,
        day,
        month: month + 1,
      });
    }
  }
  return result.sort((a, b) => a.inDays - b.inDays);
}
