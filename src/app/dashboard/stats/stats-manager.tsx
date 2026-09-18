"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getStats, type StatsKPIs, type StatsPeriod } from "./actions";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const PERIODS: Array<{ value: StatsPeriod; label: string }> = [
  { value: "today", label: "Oggi" },
  { value: "yesterday", label: "Ieri" },
  { value: "week", label: "Questa settimana" },
  { value: "month", label: "Questo mese" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Anno" },
];

type StatsManagerProps = {
  initialStats: StatsKPIs;
  initialPeriod: StatsPeriod;
};

// Simple SVG bar chart
function BarChart({ data }: { data: Array<{ label: string; value: number; color?: string }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height: `${(d.value / max) * 100}%`,
              backgroundColor: d.color ?? "#6366f1",
              minHeight: d.value > 0 ? "4px" : "0",
            }}
            title={`${d.label}: ${currencyFormatter.format(d.value)}`}
          />
          <span className="text-[10px] text-muted-foreground truncate max-w-full text-center">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// Horizontal bar chart for services
function HBarChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="truncate text-foreground">{d.name}</span>
            <span className="ml-2 text-muted-foreground shrink-0">{currencyFormatter.format(d.value)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsManager({ initialStats, initialPeriod }: StatsManagerProps) {
  const [stats, setStats] = useState(initialStats);
  const [period, setPeriod] = useState<StatsPeriod>(initialPeriod);
  const [isPending, startTransition] = useTransition();

  function handlePeriodChange(newPeriod: StatsPeriod) {
    setPeriod(newPeriod);
    startTransition(async () => {
      const result = await getStats(newPeriod);
      setStats(result);
    });
  }

  // Prepare chart data
  const dailyChartData = stats.dailyRevenue.slice(-14).map((d) => ({
    label: new Date(d.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
    value: d.revenue,
  }));

  const operatorChartData = stats.revenueByOperator.map((op) => ({
    label: op.name.split(" ")[0],
    value: op.revenue,
    color: "#8b5cf6",
  }));

  const paymentChartData = [
    { label: "Carta", value: stats.cardRevenue, color: "#6366f1" },
    { label: "Contanti", value: stats.cashRevenue, color: "#10b981" },
    { label: "Bonifico", value: stats.transferRevenue, color: "#f59e0b" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Statistiche</h1>
          <p className="text-muted-foreground">Analisi delle performance del centro.</p>
        </div>
        {isPending && <span className="text-sm text-muted-foreground">Caricamento...</span>}
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-1 rounded-lg border p-1 w-fit">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? "default" : "ghost"}
            size="sm"
            onClick={() => handlePeriodChange(p.value)}
            disabled={isPending}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Main KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fatturato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currencyFormatter.format(stats.revenue)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {stats.completedAppointments} appuntamenti completati
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket medio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currencyFormatter.format(stats.avgTicket)}</div>
            <div className="mt-1 text-xs text-muted-foreground">per appuntamento completato</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Appuntamenti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.appointments}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="text-green-600">{stats.completedAppointments} completati</span>
              {stats.cancelledAppointments > 0 && (
                <span className="text-red-500">{stats.cancelledAppointments} annullati</span>
              )}
              {stats.noShowAppointments > 0 && (
                <span className="text-orange-500">{stats.noShowAppointments} assenti</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nuove clienti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.newClients}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {stats.returningClients} ricorrenti nel periodo
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Revenue Chart */}
        {dailyChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fatturato giornaliero</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={dailyChartData} />
            </CardContent>
          </Card>
        )}

        {/* Payment methods */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metodi di pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BarChart data={paymentChartData} />
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="font-bold">{currencyFormatter.format(stats.cardRevenue)}</div>
                <div className="text-xs text-muted-foreground">💳 Carta</div>
              </div>
              <div>
                <div className="font-bold">{currencyFormatter.format(stats.cashRevenue)}</div>
                <div className="text-xs text-muted-foreground">💵 Contanti</div>
              </div>
              <div>
                <div className="font-bold">{currencyFormatter.format(stats.transferRevenue)}</div>
                <div className="text-xs text-muted-foreground">🏦 Bonifico</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top services */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top trattamenti per fatturato</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.revenueByService.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun dato nel periodo.</p>
            ) : (
              <HBarChart
                data={stats.revenueByService.map((s) => ({ name: s.name, value: s.revenue }))}
              />
            )}
          </CardContent>
        </Card>

        {/* Top clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top clienti</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun dato nel periodo.</p>
            ) : (
              <div className="space-y-3">
                {stats.topClients.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-4">{i + 1}.</span>
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{currencyFormatter.format(c.spent)}</div>
                      <div className="text-xs text-muted-foreground">{c.visits} visite</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operator stats */}
      {stats.revenueByOperator.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance operatrici</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {stats.revenueByOperator.map((op) => (
                <div key={op.name} className="rounded-lg border p-4">
                  <div className="font-medium">{op.name}</div>
                  <div className="mt-2 text-2xl font-bold">{currencyFormatter.format(op.revenue)}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{op.appointments} servizi erogati</div>
                </div>
              ))}
            </div>
            {operatorChartData.length > 0 && (
              <div className="mt-4">
                <BarChart data={operatorChartData} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Secondary KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{stats.inactiveClients}</div>
            <p className="text-sm text-muted-foreground">Clienti inattive (90+ giorni)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.productsSold}</div>
            <p className="text-sm text-muted-foreground">
              Prodotti venduti ({currencyFormatter.format(stats.productsRevenue)})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">
              {stats.appointments > 0
                ? `${Math.round((stats.noShowAppointments / stats.appointments) * 100)}%`
                : "0%"}
            </div>
            <p className="text-sm text-muted-foreground">Tasso no-show</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
