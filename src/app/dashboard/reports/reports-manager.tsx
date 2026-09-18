"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { StatsKPIs } from "@/app/dashboard/stats/actions";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

type ReportType = "daily" | "weekly" | "monthly";

const REPORT_LABELS: Record<ReportType, string> = {
  daily: "Giornaliero",
  weekly: "Settimanale",
  monthly: "Mensile",
};

type ReportsManagerProps = {
  dailyStats: StatsKPIs;
  weeklyStats: StatsKPIs;
  monthlyStats: StatsKPIs;
};

function exportCSV(stats: StatsKPIs, reportType: ReportType) {
  const dateStr = new Date().toLocaleDateString("it-IT");
  const rows: string[][] = [
    ["REPORT " + REPORT_LABELS[reportType].toUpperCase(), "", "Generato il " + dateStr],
    [],
    ["RIEPILOGO FINANZIARIO"],
    ["Fatturato totale", currencyFormatter.format(stats.revenue)],
    ["Ticket medio", currencyFormatter.format(stats.avgTicket)],
    ["Incasso carta", currencyFormatter.format(stats.cardRevenue)],
    ["Incasso contanti", currencyFormatter.format(stats.cashRevenue)],
    ["Incasso bonifico", currencyFormatter.format(stats.transferRevenue)],
    [],
    ["APPUNTAMENTI"],
    ["Totale", stats.appointments.toString()],
    ["Completati", stats.completedAppointments.toString()],
    ["Annullati", stats.cancelledAppointments.toString()],
    ["No-show", stats.noShowAppointments.toString()],
    [],
    ["CLIENTI"],
    ["Nuove clienti", stats.newClients.toString()],
    ["Clienti ricorrenti", stats.returningClients.toString()],
    ["Clienti inattive (90+ giorni)", stats.inactiveClients.toString()],
    [],
    ["PRODOTTI"],
    ["Unità vendute", stats.productsSold.toString()],
    ["Fatturato prodotti", currencyFormatter.format(stats.productsRevenue)],
    [],
    ["PERFORMANCE OPERATRICI"],
    ["Operatrice", "Fatturato", "Servizi erogati"],
    ...stats.revenueByOperator.map((op) => [op.name, currencyFormatter.format(op.revenue), op.appointments.toString()]),
    [],
    ["TOP TRATTAMENTI"],
    ["Trattamento", "Fatturato", "Prenotazioni"],
    ...stats.revenueByService.map((s) => [s.name, currencyFormatter.format(s.revenue), s.count.toString()]),
    [],
    ["TOP CLIENTI"],
    ["Cliente", "Totale speso", "Visite"],
    ...stats.topClients.map((c) => [c.name, currencyFormatter.format(c.spent), c.visits.toString()]),
  ];

  const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function KPIRow({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{label}</TableCell>
      <TableCell className="font-medium text-right">{value}</TableCell>
    </TableRow>
  );
}

function ReportSection({ stats, type }: { stats: StatsKPIs; type: ReportType }) {
  return (
    <div className="space-y-6" id={`report-${type}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Report {REPORT_LABELS[type]}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            🖨️ Stampa
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV(stats, type)}>
            📥 Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riepilogo finanziario</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <KPIRow label="Fatturato totale" value={currencyFormatter.format(stats.revenue)} />
                <KPIRow label="Ticket medio" value={currencyFormatter.format(stats.avgTicket)} />
                <KPIRow label="💳 Carta" value={currencyFormatter.format(stats.cardRevenue)} />
                <KPIRow label="💵 Contanti" value={currencyFormatter.format(stats.cashRevenue)} />
                <KPIRow label="🏦 Bonifico" value={currencyFormatter.format(stats.transferRevenue)} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appuntamenti</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <KPIRow label="Totale" value={stats.appointments.toString()} />
                <KPIRow label="Completati" value={stats.completedAppointments.toString()} />
                <KPIRow label="Annullati" value={stats.cancelledAppointments.toString()} />
                <KPIRow label="No-show" value={stats.noShowAppointments.toString()} />
                <KPIRow
                  label="Tasso no-show"
                  value={
                    stats.appointments > 0
                      ? `${Math.round((stats.noShowAppointments / stats.appointments) * 100)}%`
                      : "—"
                  }
                />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clienti</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <KPIRow label="Nuove clienti" value={stats.newClients.toString()} />
                <KPIRow label="Clienti ricorrenti" value={stats.returningClients.toString()} />
                <KPIRow label="Clienti inattive (90+ giorni)" value={stats.inactiveClients.toString()} />
                <KPIRow label="Prodotti venduti" value={`${stats.productsSold} unità`} />
                <KPIRow label="Fatturato prodotti" value={currencyFormatter.format(stats.productsRevenue)} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Operators */}
        {stats.revenueByOperator.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance operatrici</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operatrice</TableHead>
                    <TableHead className="text-right">Fatturato</TableHead>
                    <TableHead className="text-right">Servizi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.revenueByOperator.map((op) => (
                    <TableRow key={op.name}>
                      <TableCell>{op.name}</TableCell>
                      <TableCell className="text-right font-medium">{currencyFormatter.format(op.revenue)}</TableCell>
                      <TableCell className="text-right">{op.appointments}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top services */}
      {stats.revenueByService.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top trattamenti</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trattamento</TableHead>
                  <TableHead className="text-right">Prenotazioni</TableHead>
                  <TableHead className="text-right">Fatturato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.revenueByService.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                    <TableCell className="text-right font-medium">{currencyFormatter.format(s.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ReportsManager({ dailyStats, weeklyStats, monthlyStats }: ReportsManagerProps) {
  const [activeReport, setActiveReport] = useState<ReportType>("daily");

  const statsMap: Record<ReportType, StatsKPIs> = {
    daily: dailyStats,
    weekly: weeklyStats,
    monthly: monthlyStats,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Report</h1>
        <p className="text-muted-foreground">Sintesi operativa per periodo.</p>
      </div>

      <div className="flex gap-1 rounded-lg border p-1 w-fit">
        {(Object.keys(REPORT_LABELS) as ReportType[]).map((type) => (
          <Button
            key={type}
            variant={activeReport === type ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveReport(type)}
          >
            {REPORT_LABELS[type]}
          </Button>
        ))}
      </div>

      <ReportSection stats={statsMap[activeReport]} type={activeReport} />
    </div>
  );
}
