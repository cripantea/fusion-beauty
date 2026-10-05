"use client";

import { CalendarPlus, Clock, CreditCard, Gift, Inbox, Sparkles, UserPlus, UserRoundCheck, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { AppointmentDetailDialog } from "@/app/dashboard/calendar/appointment-detail-dialog";
import { AppointmentFormDialog } from "@/app/dashboard/calendar/appointment-form-dialog";
import type { OperatorDTO } from "@/app/dashboard/calendar/actions";
import type { AppointmentDTO } from "@/app/dashboard/calendar/dto";
import type { ClientListItemDTO } from "@/app/dashboard/clients/actions";
import { toNewClientListItem } from "@/app/dashboard/clients/list-item";
import { QuickClientDialog } from "@/app/dashboard/clients/quick-client-dialog";
import { PaymentDialog } from "@/app/dashboard/payments/payment-dialog";
import type { ServiceDTO } from "@/app/dashboard/services/actions";
import { EmptyState, PageHeader, Panel, Pill, StatCard } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { formatEuro, getInitials } from "@/lib/format";
import { useAdminView } from "@/lib/admin-view-context";

import { getDashboardData, type DashboardData } from "./actions";

const timeFormatter = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 13) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

type DashboardManagerProps = {
  firstName: string;
  initialData: DashboardData;
  clients: ClientListItemDTO[];
  services: ServiceDTO[];
  operators: OperatorDTO[];
};

export function DashboardManager({
  firstName,
  initialData,
  clients,
  services,
  operators,
}: DashboardManagerProps) {
  const { isAdminView } = useAdminView();
  const [data, setData] = useState(initialData);
  const [clientOptions, setClientOptions] = useState(clients);
  const [, startTransition] = useTransition();
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentDTO | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDTO | null>(null);
  const [payingAppointment, setPayingAppointment] = useState<AppointmentDTO | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  function refresh() {
    startTransition(async () => {
      setData(await getDashboardData());
    });
  }

  const now = new Date();
  const upcoming = data.appointments.filter(
    (appointment) =>
      appointment.startTime >= new Date(now.getTime() - 15 * 60000) &&
      (appointment.status === "BOOKED" || appointment.status === "CONFIRMED")
  );
  const next = upcoming[0] ?? null;
  const later = upcoming.slice(1);

  const remainingToCollect = Math.max(data.estimatedRevenueToday - data.collectedToday, 0);
  const followUp = data.followUp;
  const followUpTotal = followUp.inactive + followUp.birthdays + followUp.tomorrowReminders;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Panoramica giornaliera"
        title={`${greeting()} ${firstName} 👋`}
        description={
          <span>
            <span className="capitalize">{dateFormatter.format(now)}</span>
            {data.operatorsToday > 0
              ? ` · ${data.operatorsToday} operatric${data.operatorsToday === 1 ? "e" : "i"} in agenda`
              : ""}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              className="h-10 rounded-xl px-4"
              onClick={() => setClientDialogOpen(true)}
            >
              <UserPlus className="size-4" />
              Nuova cliente
            </Button>
            <Button
              className="h-10 rounded-xl px-4"
              onClick={() => {
                setEditingAppointment(null);
                setAppointmentDialogOpen(true);
              }}
            >
              <CalendarPlus className="size-4" />
              Nuovo appuntamento
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Oggi in agenda"
          value={`${data.appointments.length} ${data.appointments.length === 1 ? "appuntamento" : "appuntamenti"}`}
          sub={`${data.completedToday} completat${data.completedToday === 1 ? "o" : "i"}`}
          icon={Clock}
          accent="mint"
        />
        <StatCard
          label="Incasso stimato oggi"
          value={isAdminView ? formatEuro(data.estimatedRevenueToday) : "•••"}
          sub={isAdminView ? `${formatEuro(data.collectedToday)} già saldati` : ""}
          subClassName="text-amber-ink"
          icon={CreditCard}
          accent="amber"
        />
        <StatCard
          label="Nuove clienti oggi"
          value={`${data.newClientsToday} ${data.newClientsToday === 1 ? "nuova" : "nuove"}`}
          sub={`${data.totalClients} in archivio`}
          icon={Users}
          accent="teal"
        />
      </div>

      {next ? (
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-forest to-[oklch(0.24_0.04_165)] p-5 text-forest-foreground shadow-md sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold ring-2 ring-mint/50">
              {getInitials(next.client.firstName, next.client.lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <Pill tone="forest" className="border-mint/40 bg-white/10 text-mint">
                <Clock className="size-3" />
                Prossimo in arrivo ({timeFormatter.format(next.startTime)})
              </Pill>
              <div className="mt-2 font-heading text-2xl font-bold leading-tight">
                {next.client.firstName} {next.client.lastName}
              </div>
              <div className="mt-1 text-sm text-forest-foreground/80">
                Trattamento: <strong className="text-white">{next.service.name}</strong>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <div className="mr-auto text-sm">
              <div className="text-[11px] uppercase tracking-wide text-forest-foreground/60">
                Operatrice
              </div>
              <div className="font-semibold">{next.operator?.firstName ?? "Da assegnare"}</div>
            </div>
            <Button
              className="h-10 rounded-xl bg-mint px-5 font-semibold text-forest hover:bg-mint/85"
              nativeButton={false}
              render={<Link href={`/dashboard/clients/${next.client.id}`} />}
            >
              Apri scheda cliente
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl border-white/25 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setPayingAppointment(next)}
            >
              <CreditCard className="size-4" />
              Incassa
            </Button>
          </div>
        </section>
      ) : null}

      <Panel
        title="Appuntamenti di oggi"
        icon={Clock}
        action={
          <Link href="/dashboard/calendar" className="text-xs font-semibold text-mint-ink hover:underline">
            Vedi tutta l&apos;agenda →
          </Link>
        }
      >
        {data.appointments.length === 0 ? (
          <EmptyState>Nessun appuntamento per oggi. Una giornata tranquilla ✨</EmptyState>
        ) : (
          <ul className="space-y-2 p-3">
            {data.appointments.map((appointment) => {
              const paid = Boolean(appointment.payment);
              const canCollect = !paid && appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW";
              return (
                <li
                  key={appointment.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-mint-soft/60 px-3 py-2.5 transition-colors hover:bg-mint-soft"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedAppointment(appointment)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="rounded-lg border border-mint-border bg-card px-2.5 py-1 text-sm font-bold">
                      {timeFormatter.format(appointment.startTime)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {appointment.client.firstName} {appointment.client.lastName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {appointment.service.name}
                        {appointment.operator ? ` · ${appointment.operator.firstName}` : ""}
                      </span>
                    </span>
                  </button>
                  <span className="text-sm font-semibold">
                    {formatEuro(appointment.payment?.amount ?? appointment.service.price)}
                  </span>
                  {paid ? (
                    <Pill>Pagato</Pill>
                  ) : appointment.status === "CANCELLED" || appointment.status === "NO_SHOW" ? (
                    <Pill tone="slate">{appointment.status === "CANCELLED" ? "Annullato" : "Assente"}</Pill>
                  ) : null}
                  {canCollect ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-mint-border bg-card"
                      onClick={() => setPayingAppointment(appointment)}
                    >
                      Incassa
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {later.length > 0 && remainingToCollect > 0 ? (
          <div className="border-t border-mint-border/70 px-5 py-2.5 text-xs text-muted-foreground">
            Ancora da incassare oggi: <strong className="text-foreground">{formatEuro(remainingToCollect)}</strong>
          </div>
        ) : null}
      </Panel>

      {followUpTotal + followUp.pendingRequests > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/dashboard/requests",
              icon: Inbox,
              value: followUp.pendingRequests,
              label: "richieste online da confermare",
              tone: "bg-wine-soft text-wine",
            },
            {
              href: "/dashboard/followup",
              icon: UserRoundCheck,
              value: followUp.inactive,
              label: "clienti non tornano da 6+ mesi",
              tone: "bg-amber-soft text-amber-ink",
            },
            {
              href: "/dashboard/followup",
              icon: Gift,
              value: followUp.birthdays,
              label: "compleanni nei prossimi 7 giorni",
              tone: "bg-mint-soft text-mint-ink",
            },
            {
              href: "/dashboard/followup",
              icon: Sparkles,
              value: followUp.tomorrowReminders,
              label: "promemoria per domani",
              tone: "bg-mint-soft text-mint-ink",
            },
          ]
            .filter((item) => item.value > 0)
            .map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-2xl border border-mint-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
                  <item.icon className="size-5" />
                </span>
                <span className="text-sm leading-snug">
                  <strong className="font-heading text-xl">{item.value}</strong>
                  <br />
                  <span className="text-muted-foreground">{item.label}</span>
                </span>
              </Link>
            ))}
        </div>
      ) : null}

      <AppointmentFormDialog
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        appointment={editingAppointment}
        clients={clientOptions}
        services={services}
        operators={operators}
        onSuccess={refresh}
        onClientCreated={(client) => setClientOptions((current) => [...current, client])}
      />

      <AppointmentDetailDialog
        open={Boolean(selectedAppointment)}
        onOpenChange={(open) => {
          if (!open) setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        onEdit={(appointment) => {
          setSelectedAppointment(null);
          setEditingAppointment(appointment);
          setAppointmentDialogOpen(true);
        }}
        onStatusChanged={(appointment) => {
          setSelectedAppointment(appointment);
          refresh();
        }}
        onCollect={(appointment) => {
          setSelectedAppointment(null);
          setPayingAppointment(appointment);
        }}
      />

      <PaymentDialog
        open={Boolean(payingAppointment)}
        onOpenChange={(open) => {
          if (!open) setPayingAppointment(null);
        }}
        appointment={payingAppointment}
        onPaid={refresh}
      />

      <QuickClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={(client) => {
          setClientOptions((current) => [...current, toNewClientListItem(client)]);
          refresh();
        }}
      />
    </div>
  );
}
