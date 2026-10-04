import Link from "next/link";

import { PageHeader, Panel } from "@/components/boutique";
import { getTenantContext } from "@/lib/auth-context";
import { formatEuro, formatEuroRound } from "@/lib/format";
import {
  getPeriodRanges,
  getRangeMetrics,
  getRevenueBars,
  parsePeriod,
  percentDelta,
  STATS_PERIODS,
} from "@/lib/stats";
import { cn } from "@/lib/utils";

type StatsPageProps = {
  searchParams: Promise<{ period?: string }>;
};

const monthFormatter = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const { tenantId } = await getTenantContext();
  const period = parsePeriod((await searchParams).period);
  const { current, previous } = getPeriodRanges(period);

  const [metrics, previousMetrics, bars] = await Promise.all([
    getRangeMetrics(tenantId, current),
    getRangeMetrics(tenantId, previous),
    getRevenueBars(tenantId, period, current),
  ]);

  const delta = percentDelta(metrics.revenue, previousMetrics.revenue);
  const average = metrics.paymentsCount > 0 ? metrics.revenue / metrics.paymentsCount : 0;
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const topIndex = bars.findIndex((bar) => bar.value === max && max > 1);

  const periodLabel =
    period === "day"
      ? dayFormatter.format(current.start)
      : period === "week"
        ? "Questa settimana"
        : period === "month"
          ? monthFormatter.format(current.start)
          : String(current.start.getFullYear());

  const tiles = [
    {
      label: "Fatturato",
      value: formatEuro(metrics.revenue),
      sub:
        delta === null
          ? "Nessun dato nel periodo precedente"
          : `${delta >= 0 ? "+" : ""}${String(delta).replace(".", ",")}% vs periodo precedente`,
      subTone: delta !== null && delta < 0 ? "text-wine" : "text-mint-ink",
    },
    { label: "Appuntamenti", value: String(metrics.completedAppointments), sub: "Completati", subTone: "text-mint-ink" },
    {
      label: "Ticket medio",
      value: formatEuroRound(average),
      sub: "Media spesa per pagamento",
      subTone: "text-mint-ink",
    },
    { label: "Nuove clienti", value: String(metrics.newClients), sub: "Acquisite", subTone: "text-mint-ink" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Analisi andamento"
        title="Capire come sta andando il centro."
        description="Senza fare conti a mano."
      />

      <section className="overflow-hidden rounded-2xl border border-mint-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-forest px-5 py-4 text-forest-foreground">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mint">
              Statistiche del centro
            </div>
            <div className="font-heading text-xl font-bold capitalize">{periodLabel}</div>
          </div>
          <div className="flex rounded-full border border-white/15 bg-white/5 p-1">
            {STATS_PERIODS.map((item) => (
              <Link
                key={item.value}
                href={`/dashboard/stats?period=${item.value}`}
                className={cn(
                  "rounded-full px-3.5 py-1 text-sm font-medium transition-colors",
                  item.value === period
                    ? "bg-mint font-semibold text-forest"
                    : "text-forest-foreground/75 hover:text-forest-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl border border-mint-border p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {tile.label}
                </div>
                <div className="mt-1 font-heading text-3xl font-bold">{tile.value}</div>
                <div className={cn("mt-0.5 text-sm font-medium", tile.subTone)}>{tile.sub}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-mint-border p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Clienti tornate
            </div>
            <div className="mt-1 font-heading text-3xl font-bold text-mint-ink">
              {metrics.returningRate === null ? "—" : `${metrics.returningRate}%`}
            </div>
            <div className="text-sm font-medium text-mint-ink">
              {metrics.returningRate === null
                ? "Nessuna cliente servita nel periodo"
                : `Tasso fedeltà · ${metrics.servedClients} ${metrics.servedClients === 1 ? "cliente servita" : "clienti servite"}`}
            </div>
          </div>

          <Panel title="Andamento fatturato">
            <div className="p-5">
              <div className="flex h-44 items-end gap-2 sm:gap-3">
                {bars.map((bar, index) => (
                  <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {bar.value > 0 ? formatEuroRound(bar.value) : ""}
                    </span>
                    <div
                      className={cn(
                        "w-full rounded-t-lg transition-all",
                        index === topIndex ? "bg-forest" : bar.value > 0 ? "bg-mint/70" : "bg-mint-soft"
                      )}
                      style={{ height: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 6 : 3)}%` }}
                      title={`${bar.label}: ${formatEuro(bar.value)}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2 sm:gap-3">
                {bars.map((bar) => (
                  <span key={bar.label} className="flex-1 text-center text-[11px] text-muted-foreground">
                    {bar.label}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
