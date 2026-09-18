"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { AppointmentDetailDialog, statusLabels, statusVariants } from "@/app/dashboard/calendar/appointment-detail-dialog";
import { AppointmentFormDialog } from "@/app/dashboard/calendar/appointment-form-dialog";
import type { AppointmentDTO, OperatorDTO } from "@/app/dashboard/calendar/actions";
import { ClientFormDialog } from "@/app/dashboard/clients/client-form-dialog";
import type { ClientListItemDTO } from "@/app/dashboard/clients/actions";
import type { ServiceDTO } from "@/app/dashboard/services/actions";
import { Badge } from "@/components/ui/badge";
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

import { getDashboardMetrics, getTodayAppointments, type DashboardMetrics } from "./actions";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const timeFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "full" });

type DashboardManagerProps = {
  initialMetrics: DashboardMetrics;
  initialAppointments: AppointmentDTO[];
  clients: ClientListItemDTO[];
  services: ServiceDTO[];
  operators: OperatorDTO[];
};

export function DashboardManager({
  initialMetrics,
  initialAppointments,
  clients,
  services,
  operators,
}: DashboardManagerProps) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [clientOptions, setClientOptions] = useState(clients);
  const [isPending, startTransition] = useTransition();
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentDTO | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDTO | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  function refresh() {
    startTransition(async () => {
      const [nextMetrics, nextAppointments] = await Promise.all([
        getDashboardMetrics(),
        getTodayAppointments(),
      ]);
      setMetrics(nextMetrics);
      setAppointments(nextAppointments);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold capitalize">{dateFormatter.format(new Date())}</h2>
          <p className="text-sm text-muted-foreground">Panoramica operativa del centro</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setEditingAppointment(null);
              setAppointmentDialogOpen(true);
            }}
          >
            + Nuovo appuntamento
          </Button>
          <Button variant="secondary" onClick={() => setClientDialogOpen(true)}>
            + Nuova cliente
          </Button>
          <Button variant="outline" render={<Link href="/dashboard/requests" />} nativeButton={false}>
            Richieste online
            {metrics.pendingBookingRequests > 0 && (
              <Badge variant="destructive" className="ml-1.5">
                {metrics.pendingBookingRequests}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Appuntamenti oggi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.todayAppointmentsTotal}</div>
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              <span className="text-green-600">{metrics.todayAppointmentsCompleted} completati</span>
              {metrics.todayAppointmentsCancelled > 0 && (
                <span className="text-red-500">{metrics.todayAppointmentsCancelled} annullati</span>
              )}
              {metrics.todayNoShow > 0 && (
                <span className="text-orange-500">{metrics.todayNoShow} assenti</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Incasso oggi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currencyFormatter.format(metrics.realRevenueToday)}</div>
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              <span>💳 {currencyFormatter.format(metrics.revenueCardToday)}</span>
              <span>💵 {currencyFormatter.format(metrics.revenueCashToday)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nuove clienti (mese)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.newClientsThisMonth}</div>
            <p className="mt-1 text-xs text-muted-foreground">{metrics.totalClientsActive} totali in archivio</p>
          </CardContent>
        </Card>

        <Card className={metrics.inactiveClients90 > 0 ? "border-amber-300" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clienti inattive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{metrics.inactiveClients90}</div>
            <p className="mt-1 text-xs text-muted-foreground">non tornano da 90+ giorni</p>
            {metrics.inactiveClients90 > 0 && (
              <Link
                href="/dashboard/clients?segment=inactive"
                className="mt-2 block text-xs text-primary hover:underline"
              >
                Vedi e ricontatta →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operator Stats */}
      {metrics.operatorStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operatrici oggi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.operatorStats.map((op) => (
                <div key={op.id} className="rounded-lg border p-3">
                  <div className="font-medium">
                    {op.firstName} {op.lastName}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{op.appointmentsToday} appuntamenti</span>
                    <span className="font-medium text-foreground">
                      {currencyFormatter.format(op.revenueToday)}
                    </span>
                  </div>
                  {op.nextAppointment && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Prossima: {timeFormatter.format(op.nextAppointment)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today Appointments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Appuntamenti di oggi</CardTitle>
            <Button variant="outline" size="sm" render={<Link href="/dashboard/calendar" />} nativeButton={false}>
              Apri agenda
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Trattamento</TableHead>
                <TableHead>Operatrice</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {isPending ? "Caricamento..." : "Nessun appuntamento per oggi."}
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((appointment) => (
                  <TableRow
                    key={appointment.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedAppointment(appointment)}
                  >
                    <TableCell className="font-medium">
                      {timeFormatter.format(appointment.startTime)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/clients/${appointment.client.id}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {appointment.client.firstName} {appointment.client.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{appointment.service.name}</TableCell>
                    <TableCell>
                      {appointment.operator
                        ? `${appointment.operator.firstName} ${appointment.operator.lastName}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {appointment.price !== null
                        ? currencyFormatter.format(appointment.price)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[appointment.status]}>
                        {statusLabels[appointment.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {appointment.payment ? (
                        <Badge variant="outline" className="border-green-600 text-green-700 text-xs">
                          ✓ Pagato
                        </Badge>
                      ) : appointment.status === "CANCELLED" || appointment.status === "NO_SHOW" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Da incassare</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AppointmentFormDialog
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        appointment={editingAppointment}
        clients={clientOptions}
        services={services}
        operators={operators}
        onSuccess={refresh}
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
      />

      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSuccess={(client) => {
          setClientOptions((current) => [
            ...current,
            {
              ...client,
              lastAppointment: null,
              nextAppointment: null,
              visitCount: 0,
              totalSpent: 0,
              segment: "new" as const,
            },
          ]);
        }}
      />
    </div>
  );
}
