import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { appointmentServiceNames, extraServicesSelect } from "@/lib/appointment-services";
import { isPaymentsEnabled } from "@/lib/payments-mode";
import { romeParts } from "@/lib/rome-time";
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

/** Spesa stimata per cliente: prezzi di listino dei trattamenti svolti (anche quelli in più nello stesso appuntamento). */
async function estimatedSpend(tenantId: string, clientIds?: string[]) {
  if (clientIds && clientIds.length === 0) return [];
  const rows = await prisma.$queryRaw<{ clientId: string; total: Prisma.Decimal | null }[]>`
    SELECT a."clientId",
      SUM(s.price + COALESCE((SELECT SUM(e.price) FROM appointment_extra_services e WHERE e."appointmentId" = a.id), 0)) AS total
    FROM appointments a JOIN services s ON s.id = a."serviceId"
    WHERE a."tenantId" = ${tenantId} AND a.status = 'COMPLETED'
      ${clientIds ? Prisma.sql`AND a."clientId" IN (${Prisma.join(clientIds)})` : Prisma.empty}
    GROUP BY a."clientId"`;
  return rows.map((r) => ({ clientId: r.clientId, total: r.total ? Number(r.total) : 0 }));
}

/** Statistiche per cliente (trattamenti completati + totale incassato) in due query aggregate. */
export async function getClientStatsMap(tenantId: string, clientIds?: string[]) {
  const clientFilter = clientIds ? { clientId: { in: clientIds } } : {};

  const paymentsEnabled = await isPaymentsEnabled(tenantId);
  const [visitGroups, spendGroups] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { tenantId, status: "COMPLETED", ...clientFilter },
      _count: { _all: true },
      _max: { startTime: true },
    }),
    paymentsEnabled
      ? prisma.payment
          .groupBy({ by: ["clientId"], where: { tenantId, ...clientFilter }, _sum: { amount: true } })
          .then((groups) => groups.map((g) => ({ clientId: g.clientId, total: g._sum.amount?.toNumber() ?? 0 })))
      : estimatedSpend(tenantId, clientIds),
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
    current.totalSpent = group.total;
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
    select: { clientId: true, service: { select: { name: true } }, extraServices: extraServicesSelect },
  });
  const serviceByClient = new Map(lastServices.map((row) => [row.clientId, appointmentServiceNames(row)]));

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

  // "Oggi" in ora italiana (il server gira in UTC).
  const rome = romeParts(new Date());
  const today = new Date(Date.UTC(rome.year, rome.month - 1, rome.day));
  const todayUtc = today.getTime();

  const result: BirthdayClient[] = [];
  for (const client of clients) {
    const dob = client.dateOfBirth!;
    const month = dob.getUTCMonth();
    const day = dob.getUTCDate();
    let next = Date.UTC(today.getUTCFullYear(), month, day);
    if (next < todayUtc) next = Date.UTC(today.getUTCFullYear() + 1, month, day);
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
