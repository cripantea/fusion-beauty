"use client";

import { CalendarClock, CreditCard, Link2, MessageCircle, Phone } from "lucide-react";
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
import { ConsentNotice } from "@/app/dashboard/consents/consent-notice";
import { sendPaymentLink } from "@/app/dashboard/payment-links/actions";

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
  /** Apre la modifica direttamente su data e ora (senza: si apre la modifica normale). */
  onMove?: (appointment: AppointmentDTO) => void;
  onStatusChanged: (appointment: AppointmentDTO) => void;
  onCollect: (appointment: AppointmentDTO) => void;
  /** Incassi in cassa attivi (Incassa, POS): spenti si mostra solo il prezzo di listino. */
  paymentsEnabled: boolean;
  /** Stripe collegato: link di pagamento online (anche in 3 rate con Klarna). */
  onlinePayments: boolean;
  /** "Cambia importo": apre il dialog del link di pagamento. */
  onPaymentLink: (appointment: AppointmentDTO) => void;
  /** Link mandato con un tocco: aggiorna l'appuntamento in lista. */
  onPaymentLinkSent?: (appointment: AppointmentDTO) => void;
};

const PAID_WITH: Record<string, string> = { card: "carta", klarna: "Klarna", satispay: "Satispay", link: "Link", paypal: "PayPal" };

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onMove,
  onStatusChanged,
  onCollect,
  paymentsEnabled,
  onlinePayments,
  onPaymentLink,
  onPaymentLinkSent,
}: AppointmentDetailDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [isSendingLink, startSendingLink] = useTransition();
  const [consentOpen, setConsentOpen] = useState(false);
  // Annullato/Assente chiedono conferma prima di salvare.
  const [confirming, setConfirming] = useState<{ id: string; status: "CANCELLED" | "NO_SHOW" } | null>(null);

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

      setConfirming(null);
      toast.success(`Stato aggiornato a "${statusLabels[status]}".`);
      onStatusChanged(result.appointment);
    });
  }

  const link = appointment.paymentLink;
  const canCollect = paymentsEnabled && !appointment.payment && link?.status !== "PAID" && !["CANCELLED", "NO_SHOW"].includes(appointment.status);
  // Un tocco: link già da pagare (stesso importo, si rimanda) o prezzo del trattamento.
  const linkAmount = link?.status === "PENDING" ? link.amountCents / 100 : appointment.service.price;

  function handleSendLink() {
    if (!appointment) return;
    const current = appointment;
    startSendingLink(async () => {
      const result = await sendPaymentLink({ appointmentId: current.id, amount: linkAmount });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onPaymentLinkSent?.({ ...current, paymentLink: { status: "PENDING", amountCents: result.amountCents, token: result.token, paidWith: null } });
      if (result.sent) toast.success("Link inviato su WhatsApp.");
      else if (result.fallbackUrl) {
        // Senza "noopener" nelle opzioni: con quello window.open restituisce sempre null.
        const opened = window.open(result.fallbackUrl, "_blank");
        if (opened) opened.opener = null;
        const fallbackUrl = result.fallbackUrl;
        // Popup bloccato dal browser: si apre con un tocco dal messaggio.
        if (!opened) toast("Link pronto", { action: { label: "Apri WhatsApp", onClick: () => window.open(fallbackUrl, "_blank", "noopener,noreferrer") } });
      }
    });
  }
  const canSendLink = onlinePayments && link?.status !== "PAID" && !["CANCELLED", "NO_SHOW"].includes(appointment.status);
  // "Assente" ha senso solo da quando l'appuntamento è iniziato.
  const started = appointment.startTime <= new Date();
  const secondaryStatuses = (["CONFIRMED", "CANCELLED", "NO_SHOW"] as const).filter(
    (status) => status !== appointment.status && (status !== "NO_SHOW" || started)
  );
  const pendingConfirm = confirming?.id === appointment.id ? confirming.status : null;
  const canMove = appointment.status === "BOOKED" || appointment.status === "CONFIRMED";

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
            <span className="text-muted-foreground">{paymentsEnabled ? "Importo" : "Prezzo di listino"}</span>
            <span className="font-semibold">
              {paymentsEnabled && appointment.payment
                ? `${formatEuro(appointment.payment.amount)} · ${appointment.payment.method === "CARD" ? "Carta" : appointment.payment.method === "CASH" ? "Contanti" : "Altro"}`
                : formatEuro(appointment.service.price)}
            </span>
          </div>
          {link ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Pagamento online</span>
              {link.status === "PAID" ? (
                <Pill tone="forest">
                  Pagato online {formatEuro(link.amountCents / 100)}
                  {link.paidWith ? ` · ${PAID_WITH[link.paidWith] ?? link.paidWith}` : ""}
                </Pill>
              ) : (
                <Pill tone="amber">Link inviato · {formatEuro(link.amountCents / 100)}</Pill>
              )}
            </div>
          ) : null}
          {appointment.notes ? (
            <div className="border-t pt-2">
              <span className="text-muted-foreground">Note: </span>
              {appointment.notes}
            </div>
          ) : null}
        </div>

        {/* Trattamento con consenso (es. laser): da firmare (link alla cliente) o già firmato. */}
        {appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW" ? (
          <ConsentNotice
            key={appointment.id}
            clientId={appointment.client.id}
            clientName={`${appointment.client.firstName} ${appointment.client.lastName}`}
            appointment={{ id: appointment.id, serviceId: appointment.service.id, serviceName: appointment.service.name }}
          />
        ) : null}

        {canCollect ? (
          <Button
            className="h-11 w-full rounded-xl text-base"
            onClick={() => onCollect(appointment)}
          >
            <CreditCard className="size-5" />
            Incassa {formatEuro(appointment.service.price)}
          </Button>
        ) : null}

        {canSendLink ? (
          <div className="space-y-1">
            <Button
              variant={canCollect ? "outline" : "default"}
              className="h-11 w-full rounded-xl text-base"
              disabled={isSendingLink}
              onClick={handleSendLink}
            >
              <Link2 className="size-5" />
              {isSendingLink
                ? "Invio in corso…"
                : `${link?.status === "PENDING" ? "Rimanda link di pagamento" : "Invia link di pagamento"} · ${formatEuro(linkAmount)}`}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => onPaymentLink(appointment)}
            >
              Cambia importo · anche in 3 rate (se disponibile)
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canMove ? (
            <Button variant="outline" size="sm" className="h-10 sm:h-7" onClick={() => (onMove ?? onEdit)(appointment)}>
              <CalendarClock className="size-3.5" />
              Sposta
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-10 sm:h-7"
            nativeButton={false}
            render={<a href={whatsappUrl(appointment.client.phone, reminderText)} target="_blank" rel="noopener noreferrer" />}
          >
            <MessageCircle className="size-3.5" />
            Promemoria
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 sm:h-7"
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
              className="h-10 sm:h-7"
              disabled={isPending}
              onClick={() =>
                status === "CONFIRMED"
                  ? handleStatusChange(status)
                  : setConfirming({ id: appointment.id, status })
              }
            >
              {status === "CONFIRMED" ? "Conferma" : statusLabels[status]}
            </Button>
          ))}
        </div>

        {pendingConfirm ? (
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">
              {pendingConfirm === "CANCELLED"
                ? "Annullare l'appuntamento? La cliente non riceve messaggi automatici."
                : "Segnare la cliente come assente? La cliente non riceve messaggi automatici."}
            </p>
            <p className="text-xs text-muted-foreground">I promemoria già programmati vengono fermati.</p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="h-10"
                disabled={isPending}
                onClick={() => handleStatusChange(pendingConfirm)}
              >
                {pendingConfirm === "CANCELLED" ? "Sì, annulla" : "Sì, assente"}
              </Button>
              <Button variant="outline" className="h-10" onClick={() => setConfirming(null)}>
                No
              </Button>
            </div>
          </div>
        ) : null}

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
