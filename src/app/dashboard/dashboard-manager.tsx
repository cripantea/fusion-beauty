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
          <h2 className="text-xl font-semibold">Panoramica di oggi</h2>
          <p className="capitalize text-muted-foreground">{dateFormatter.format(new Date())}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingAppointment(null);
              setAppointmentDialogOpen(true);
            }}
          >
            Nuovo appuntamento
          </Button>
          <Button variant="secondary" onClick={() => setClientDialogOpen(true)}>
            Nuovo cliente
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Appuntamenti oggi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{metrics.todayAppointmentsTotal}</div>
            <p className="text-sm text-muted-foreground">
              {metrics.todayAppointmentsCompleted} completati
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Nuovi clienti (mese)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{metrics.newClientsThisMonth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Incasso stimato oggi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {currencyFormatter.format(metrics.estimatedRevenueToday)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appuntamenti di oggi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Trattamento</TableHead>
                <TableHead>Operatore</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                    <TableCell>{timeFormatter.format(appointment.startTime)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/clients/${appointment.client.id}`}
                        className="hover:underline"
                        onClick={(event) => event.stopPropagation()}
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
                      <Badge variant={statusVariants[appointment.status]}>
                        {statusLabels[appointment.status]}
                      </Badge>
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
          setClientOptions((current) => [...current, { ...client, lastAppointment: null }]);
        }}
      />
    </div>
  );
}
