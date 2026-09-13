"use client";

import { useTransition } from "react";
import { toast } from "sonner";

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

import { updateAppointmentStatus, type AppointmentDTO } from "./actions";
import { APPOINTMENT_STATUSES, type AppointmentStatusValue } from "./schema";

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

  if (!appointment) {
    return null;
  }

  const otherStatuses = APPOINTMENT_STATUSES.filter(
    (status) => status !== appointment.status
  );

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {appointment.client.firstName} {appointment.client.lastName}
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
            <span className="text-muted-foreground">Operatore: </span>
            {appointment.operator
              ? `${appointment.operator.firstName} ${appointment.operator.lastName}`
              : "-"}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Stato: </span>
            <Badge variant={statusVariants[appointment.status]}>
              {statusLabels[appointment.status]}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
          <Button onClick={() => onEdit(appointment)}>Modifica</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
