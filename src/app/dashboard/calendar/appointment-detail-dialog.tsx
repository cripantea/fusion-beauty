"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PaymentDialog } from "@/app/dashboard/payments/payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { updateAppointmentStatus, updateReminderStatus, type AppointmentDTO } from "./actions";
import { APPOINTMENT_STATUSES, type AppointmentStatusValue } from "./schema";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

export const statusLabels: Record<AppointmentStatusValue, string> = {
  BOOKED: "Prenotato",
  CONFIRMED: "Confermato",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "Assente",
};

export const statusVariants: Record<
  AppointmentStatusValue,
  "default" | "secondary" | "destructive" | "outline"
> = {
  BOOKED: "secondary",
  CONFIRMED: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

const reminderLabels: Record<string, string> = {
  NONE: "Nessuno",
  SCHEDULED: "Programmato",
  SENT: "Inviato",
  FAILED: "Errore",
};

const reminderVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  NONE: "secondary",
  SCHEDULED: "default",
  SENT: "outline",
  FAILED: "destructive",
};

type AppointmentDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentDTO | null;
  onEdit: (appointment: AppointmentDTO) => void;
  onStatusChanged: (appointment: AppointmentDTO) => void;
};

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onStatusChanged,
}: AppointmentDetailDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (!appointment) {
    return null;
  }

  const otherStatuses = APPOINTMENT_STATUSES.filter(
    (status) => status !== appointment.status
  );

  const canPay =
    appointment.status !== "CANCELLED" &&
    appointment.status !== "NO_SHOW" &&
    !appointment.payment;

  function handleStatusChange(status: AppointmentStatusValue) {
    if (!appointment) return;

    startTransition(async () => {
      const result = await updateAppointmentStatus(appointment.id, status);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Stato aggiornato a "${statusLabels[status]}".`);
      onStatusChanged(result.appointment);
    });
  }

  function handleSendReminder() {
    if (!appointment) return;

    startTransition(async () => {
      const result = await updateReminderStatus(appointment.id, "SENT");
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Reminder WhatsApp inviato.");
      onStatusChanged(result.appointment);
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Link
                href={`/dashboard/clients/${appointment.client.id}`}
                className="hover:underline"
                onClick={() => onOpenChange(false)}
              >
                {appointment.client.firstName} {appointment.client.lastName}
              </Link>
            </DialogTitle>
            <DialogDescription>{appointment.service.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Data e ora: </span>
              {dateTimeFormatter.format(appointment.startTime)} –{" "}
              {timeFormatter.format(appointment.endTime)}
            </div>
            <div>
              <span className="text-muted-foreground">Operatrice: </span>
              {appointment.operator
                ? `${appointment.operator.firstName} ${appointment.operator.lastName}`
                : "-"}
            </div>
            {appointment.price !== null && (
              <div>
                <span className="text-muted-foreground">Importo: </span>
                <span className="font-medium">{currencyFormatter.format(appointment.price)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Stato: </span>
              <Badge variant={statusVariants[appointment.status]}>
                {statusLabels[appointment.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Pagamento: </span>
              {appointment.payment ? (
                <Badge variant="outline" className="border-green-600 text-green-700">
                  ✓ Pagato {currencyFormatter.format(appointment.payment.amount)}
                </Badge>
              ) : (
                <Badge variant="secondary">Da incassare</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Reminder: </span>
              <Badge variant={reminderVariants[appointment.reminderStatus]}>
                {reminderLabels[appointment.reminderStatus]}
              </Badge>
            </div>
            {appointment.notes ? (
              <div>
                <span className="text-muted-foreground">Note: </span>
                {appointment.notes}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {otherStatuses.map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleStatusChange(status)}
              >
                {statusLabels[status]}
              </Button>
            ))}
            {appointment.reminderStatus === "NONE" && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleSendReminder}
              >
                📱 Invia reminder
              </Button>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2">
            {canPay && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setPaymentOpen(true)}
              >
                💳 Incassa
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Chiudi
            </Button>
            <Button onClick={() => onEdit(appointment)}>Modifica</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        appointment={appointment}
        onSuccess={() => {
          onStatusChanged({ ...appointment, status: "COMPLETED", payment: null });
        }}
      />
    </>
  );
}
