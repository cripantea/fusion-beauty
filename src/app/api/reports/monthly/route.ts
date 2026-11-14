import { appointmentOperatorNames, appointmentServiceNames, appointmentTotalPrice, extraServicesSelect } from "@/lib/appointment-services";
import { getTenantContext } from "@/lib/auth-context";
import { isPaymentsEnabled } from "@/lib/payments-mode";
import { parseMonth } from "@/lib/reports";
import { prisma } from "@/lib/prisma";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const methodLabels = { CARD: "Carta/POS", CASH: "Contanti", TRANSFER: "Bonifico", OTHER: "Altro" } as const;

function csvCell(value: string) {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvAmount(value: number) {
  return value.toFixed(2).replace(".", ",");
}

/** Export CSV (separatore ";", compatibile con Excel italiano) degli incassi del mese. */
export async function GET(request: Request) {
  const { tenantId } = await getTenantContext();
  const month = parseMonth(new URL(request.url).searchParams.get("month") ?? undefined);

  if (!(await isPaymentsEnabled(tenantId))) return estimateCsv(tenantId, month);

  const payments = await prisma.payment.findMany({
    where: { tenantId, paidAt: { gte: month.start, lt: month.end } },
    orderBy: { paidAt: "asc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      appointment: {
        select: {
          service: { select: { name: true } },
          extraServices: extraServicesSelect,
          operator: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const rows = [["Data", "Cliente", "Trattamento", "Operatrice", "Metodo", "Importo (EUR)"]];
  let total = 0;
  for (const payment of payments) {
    const amount = payment.amount.toNumber();
    total += amount;
    rows.push([
      dateTimeFormatter.format(payment.paidAt),
      `${payment.client.firstName} ${payment.client.lastName}`,
      payment.appointment ? appointmentServiceNames(payment.appointment) : "",
      payment.appointment ? appointmentOperatorNames(payment.appointment, { full: true }) : "",
      methodLabels[payment.method],
      csvAmount(amount),
    ]);
  }
  rows.push(["", "", "", "", "Totale", csvAmount(total)]);

  const body = "﻿" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${month.key}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Senza incassi in cassa: trattamenti svolti nel mese con il prezzo di listino (stima). */
async function estimateCsv(tenantId: string, month: ReturnType<typeof parseMonth>) {
  const appointments = await prisma.appointment.findMany({
    where: { tenantId, status: "COMPLETED", startTime: { gte: month.start, lt: month.end } },
    orderBy: { startTime: "asc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      service: { select: { name: true, price: true } },
      extraServices: extraServicesSelect,
      operator: { select: { firstName: true, lastName: true } },
    },
  });
  const rows = [["Data", "Cliente", "Trattamento", "Operatrice", "Prezzo di listino (EUR)"]];
  let total = 0;
  for (const appointment of appointments) {
    const price = appointmentTotalPrice(appointment);
    total += price;
    rows.push([
      dateTimeFormatter.format(appointment.startTime),
      `${appointment.client.firstName} ${appointment.client.lastName}`,
      appointmentServiceNames(appointment),
      appointmentOperatorNames(appointment, { full: true }),
      csvAmount(price),
    ]);
  }
  rows.push(["", "", "", "Totale stimato (non verificato)", csvAmount(total)]);
  const body = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-stimato-${month.key}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
