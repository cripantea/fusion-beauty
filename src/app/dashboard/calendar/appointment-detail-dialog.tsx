"use client";

import { CreditCard, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pill } from "@/components/boutique";
import { formatEuro, whatsappUrl } from "@/lib/format";

import { ConsentCollectDialog } from "@/app/dashboard/consents/consent-collect-dialog";

import { updateAppointmentStatus } from "./actions";
import type { AppointmentDTO } from "./dto";
import type { AppointmentStatusValue } from "./schema";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "2-digit",
  month: "long",
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

export const statusTones: Record<AppointmentStatusValue, "mint" | "amber" | "wine" | "slate" | "forest"> = {
  BOOKED: "slate",
  CONFIRMED: "mint",
  COMPLETED: "forest",
  CANCELLED: "wine",
  NO_SHOW: "amber",
};

type AppointmentDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentDTO | null;
  onEdit: (appointment: AppointmentDTO) => void;
  onStatusChanged: (appointment: AppointmentDTO) => void;
  onCollect: (appointment: AppointmentDTO) => void;
};

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onStatusChanged,
  onCollect,
}: AppointmentDetailDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [consentOpen, setConsentOpen] = useState(false);

  if (!appointment) {
    return null;
  }

  const reminderText =
    `Ciao ${appointment.client.firstName} 😊 ti ricordiamo il tuo appuntamento ` +
    `${new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(appointment.startTime)} ` +
    `alle ${timeFormatter.format(appointment.startTime)} (${appointment.service.name}). A presto!`;

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

  const canCollect = !appointment.payment && !["CANCELLED", "NO_SHOW"].includes(appointment.status);
  const secondaryStatuses = (["CONFIRMED", "CANCELLED", "NO_SHOW"] as const).filter(
    (status) => status !== appointment.status
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
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

        <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Quando</span>
            <span className="text-right font-medium capitalize">
              {dateTimeFormatter.format(appointment.startTime)} – {timeFormatter.format(appointment.endTime)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Operatrice</span>
            <span className="font-medium">
              {appointment.operator
                ? `${appointment.operator.firstName} ${appointment.operator.lastName}`
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Stato</span>
            <span className="flex items-center gap-2">
              {appointment.source === "ONLINE" ? <Pill tone="amber">Da sito</Pill> : null}
              <Pill tone={statusTones[appointment.status]}>{statusLabels[appointment.status]}</Pill>
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Importo</span>
            <span className="font-semibold">
              {appointment.payment
                ? `${formatEuro(appointment.payment.amount)} · ${appointment.payment.method === "CARD" ? "Carta" : appointment.payment.method === "CASH" ? "Contanti" : "Altro"}`
                : formatEuro(appointment.service.price)}
            </span>
          </div>
          {appointment.notes ? (
            <div className="border-t pt-2">
              <span className="text-muted-foreground">Note: </span>
              {appointment.notes}
            </div>
          ) : null}
        </div>

        {canCollect ? (
          <Button
            className="h-11 w-full rounded-xl text-base"
            onClick={() => onCollect(appointment)}
          >
            <CreditCard className="size-5" />
            Incassa {formatEuro(appointment.service.price)}
          </Button>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={whatsappUrl(appointment.client.phone, reminderText)} target="_blank" rel="noopener noreferrer" />}
          >
            <MessageCircle className="size-3.5" />
            Promemoria
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`tel:${appointment.client.phone}`} />}
          >
            <Phone className="size-3.5" />
            Chiama
          </Button>
          {secondaryStatuses.map((status) => (
            <Button
              key={status}
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => handleStatusChange(status)}
            >
              {status === "CONFIRMED" ? "Conferma" : statusLabels[status]}
            </Button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setConsentOpen(true)}>
            Raccogli consenso
          </Button>
          <Button onClick={() => onEdit(appointment)}>Modifica</Button>
        </DialogFooter>

        <ConsentCollectDialog
          open={consentOpen}
          onOpenChange={setConsentOpen}
          clientId={appointment.client.id}
          clientName={`${appointment.client.firstName} ${appointment.client.lastName}`}
          appointment={{
            id: appointment.id,
            serviceId: appointment.service.id,
            serviceName: appointment.service.name,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
