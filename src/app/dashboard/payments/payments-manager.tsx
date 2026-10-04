"use client";

import { Banknote, CreditCard, Receipt, Wallet } from "lucide-react";
import { useState, useTransition } from "react";

import type { AppointmentDTO } from "@/app/dashboard/calendar/dto";
import { EmptyState, PageHeader, Panel, Pill, StatCard } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/format";

import { getPaymentsOverview, type PaymentsOverview } from "./actions";
import { PaymentDialog } from "./payment-dialog";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const methodLabels = { CARD: "Carta / POS", CASH: "Contanti", TRANSFER: "Bonifico", OTHER: "Altro" } as const;

export function PaymentsManager({ initialOverview }: { initialOverview: PaymentsOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [paying, setPaying] = useState<AppointmentDTO | null>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => setOverview(await getPaymentsOverview()));
  }

  const toCollectTotal = overview.toCollect.reduce((sum, appointment) => sum + appointment.service.price, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Pagamenti"
        title="Pagamenti più ordinati."
        description="Sapete sempre chi ha pagato, cosa ha fatto e quanto ha speso."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Incassato oggi" value={formatEuro(overview.todayTotal)} icon={Wallet} accent="mint" />
        <StatCard label="Carta / POS oggi" value={formatEuro(overview.todayCard)} icon={CreditCard} accent="teal" />
        <StatCard label="Contanti oggi" value={formatEuro(overview.todayCash)} icon={Banknote} accent="amber" />
        <StatCard label="Incassato nel mese" value={formatEuro(overview.monthTotal)} icon={Receipt} accent="mint" />
      </div>

      <Panel
        title={`Da incassare${overview.toCollect.length ? ` · ${overview.toCollect.length}` : ""}`}
        action={
          overview.toCollect.length > 0 ? (
            <span className="text-xs font-semibold text-amber-ink">{formatEuro(toCollectTotal)}</span>
          ) : null
        }
      >
        {overview.toCollect.length === 0 ? (
          <EmptyState>Tutto incassato. Ottimo lavoro ✨</EmptyState>
        ) : (
          <ul className="space-y-2 p-3">
            {overview.toCollect.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-soft/70 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {appointment.client.firstName} {appointment.client.lastName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {appointment.service.name} · {dateTimeFormatter.format(appointment.startTime)}
                  </div>
                </div>
                <span className="text-sm font-semibold">{formatEuro(appointment.service.price)}</span>
                <Button className="h-8 rounded-lg" size="sm" onClick={() => setPaying(appointment)}>
                  Incassa
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Ultimi incassi">
        {overview.recent.length === 0 ? (
          <EmptyState>Nessun pagamento registrato.</EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/60">
            {overview.recent.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {payment.client.firstName} {payment.client.lastName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {payment.serviceName ?? "Pagamento"} · {dateTimeFormatter.format(payment.paidAt)}
                  </div>
                </div>
                <Pill tone={payment.method === "CARD" ? "forest" : "mint"}>{methodLabels[payment.method]}</Pill>
                <span className="w-20 text-right font-semibold">{formatEuro(payment.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <PaymentDialog
        open={Boolean(paying)}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        appointment={paying}
        onPaid={refresh}
      />
    </div>
  );
}
