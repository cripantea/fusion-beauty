import { getTenantContext } from "@/lib/auth-context";
import { parseMonth } from "@/lib/reports";
import { prisma } from "@/lib/prisma";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
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

  const payments = await prisma.payment.findMany({
    where: { tenantId, paidAt: { gte: month.start, lt: month.end } },
    orderBy: { paidAt: "asc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      appointment: {
        select: {
          service: { select: { name: true } },
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
      payment.appointment?.service.name ?? "",
      payment.appointment?.operator
        ? `${payment.appointment.operator.firstName} ${payment.appointment.operator.lastName}`
        : "",
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
