import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { getTenantContext } from "@/lib/auth-context";
import { formatEuro } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getMonthlyReport, parseMonth } from "@/lib/reports";

import { PrintButton } from "./print-button";

type ReportsPageProps = {
  searchParams: Promise<{ month?: string }>;
};

const monthFormatter = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });

function shiftMonth(start: Date, delta: number) {
  const date = new Date(start.getFullYear(), start.getMonth() + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { tenantId } = await getTenantContext();
  const { month: monthParam } = await searchParams;

  const [report, tenant] = await Promise.all([
    getMonthlyReport(tenantId, monthParam),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
  ]);
  const { metrics } = report;
  const isCurrentMonth = report.key === parseMonth(undefined).key;
  const monthLabel = monthFormatter.format(report.start);

  const summary = [
    { label: "Fatturato totale", value: formatEuro(metrics.revenue) },
    { label: "Appuntamenti eseguiti", value: `${metrics.completedAppointments} sedute` },
    { label: "Nuove clienti acquisite", value: `${metrics.newClients} nuove clienti` },
    {
      label: "Clienti tornate",
      value: metrics.returningRate === null ? "—" : `${metrics.returningRate}% rientro`,
    },
    { label: "Top trattamento", value: report.topService?.name ?? "—" },
    {
      label: "Ticket medio",
      value: formatEuro(metrics.paymentsCount > 0 ? metrics.revenue / metrics.paymentsCount : 0),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Report"
        title="Il riepilogo pronto quando ti serve."
        description="Niente più conti ricostruiti a fine mese."
        actions={
          <div className="flex items-center gap-1 print:hidden">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label="Mese precedente"
              nativeButton={false}
              render={<Link href={`/dashboard/reports?month=${shiftMonth(report.start, -1)}`} />}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label="Mese successivo"
              disabled={isCurrentMonth}
              nativeButton={false}
              render={<Link href={`/dashboard/reports?month=${shiftMonth(report.start, 1)}`} />}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <section className="rounded-2xl border border-mint-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-mint-border/70 pb-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mint-ink">
              Documento ufficiale
            </div>
            <h2 className="font-heading text-2xl font-bold capitalize">Report mensile — {monthLabel}</h2>
            <div className="text-sm text-muted-foreground">{tenant.name}</div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant="outline"
              className="h-9 rounded-full"
              nativeButton={false}
              render={<a href={`/api/reports/monthly?month=${report.key}`} />}
            >
              <Download className="size-4" />
              Excel / CSV
            </Button>
            <PrintButton />
          </div>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-5 rounded-xl bg-muted/50 p-5 sm:grid-cols-2">
          {summary.map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 text-lg font-bold">{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Performance operatrici</h3>
          {report.operators.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun trattamento completato nel mese.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Operatrice</th>
                  <th className="py-2 text-right font-medium">Trattamenti</th>
                  <th className="py-2 text-right font-medium">Incassato</th>
                </tr>
              </thead>
              <tbody>
                {report.operators.map((operator) => (
                  <tr key={operator.name} className="border-b border-mint-border/50 last:border-0">
                    <td className="py-2 font-medium">{operator.name}</td>
                    <td className="py-2 text-right">{operator.appointments}</td>
                    <td className="py-2 text-right font-semibold">{formatEuro(operator.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
