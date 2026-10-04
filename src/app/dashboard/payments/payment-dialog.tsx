"use client";

import { Banknote, CheckCircle2, CreditCard } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { AppointmentDTO } from "@/app/dashboard/calendar/dto";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatEuro } from "@/lib/format";

import { registerPayment } from "./actions";

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentDTO | null;
  onPaid: (appointment: AppointmentDTO) => void;
};

/** Incasso in un tap: importo precompilato col prezzo del trattamento, poi Carta/POS o Contanti. */
export function PaymentDialog({
  open,
  onOpenChange,
  appointment,
  onPaid,
}: PaymentDialogProps) {
  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="sr-only">Incasso</DialogTitle>
        <DialogDescription className="sr-only">
          Registra il pagamento di {appointment.client.firstName}{" "}
          {appointment.client.lastName}
        </DialogDescription>
        <PaymentBody
          key={appointment.id}
          appointment={appointment}
          onClose={() => onOpenChange(false)}
          onPaid={onPaid}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentBody({
  appointment,
  onClose,
  onPaid,
}: {
  appointment: AppointmentDTO;
  onClose: () => void;
  onPaid: (appointment: AppointmentDTO) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(
    String(appointment.payment?.amount ?? appointment.service.price),
  );
  const [paid, setPaid] = useState<AppointmentDTO | null>(null);

  const parsedAmount = Number(amount.replace(",", "."));
  const validAmount =
    Number.isFinite(parsedAmount) && parsedAmount >= 0 && amount.trim() !== "";

  function pay(method: "CARD" | "CASH") {
    if (!validAmount) return;
    startTransition(async () => {
      const result = await registerPayment({
        appointmentId: appointment.id,
        method,
        amount: parsedAmount,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setPaid(result.appointment);
      onPaid(result.appointment);
    });
  }

  return (
    <>
      {paid ? (
        <div className="space-y-3 py-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint-soft text-mint-ink">
            <CheckCircle2 className="size-7" />
          </div>
          <div className="font-heading text-2xl font-bold">
            Pagamento registrato
          </div>
          <p className="text-sm text-muted-foreground">
            {formatEuro(paid.payment?.amount ?? 0)} ·{" "}
            {paid.payment?.method === "CARD" ? "Carta / POS" : "Contanti"} ·{" "}
            {paid.client.firstName} {paid.client.lastName}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 h-11 w-full rounded-xl bg-forest text-sm font-semibold text-forest-foreground"
          >
            Chiudi
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Incasso
          </div>
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="text-lg font-bold uppercase leading-tight">
              {appointment.client.firstName} {appointment.client.lastName}
            </div>
            <div className="text-sm text-muted-foreground">
              {appointment.service.name}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="font-heading text-3xl font-bold">€</span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-label="Importo"
                className="h-12 flex-1 border-0 bg-transparent px-0 text-3xl font-bold shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isPending || !validAmount}
              onClick={() => pay("CARD")}
              className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl bg-forest text-sm font-semibold text-forest-foreground transition hover:bg-forest/90 disabled:opacity-50"
            >
              <CreditCard className="size-5" />
              Carta / POS
            </button>
            <button
              type="button"
              disabled={isPending || !validAmount}
              onClick={() => pay("CASH")}
              className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-mint-border bg-mint-soft text-sm font-semibold text-forest transition hover:bg-mint/30 disabled:opacity-50"
            >
              <Banknote className="size-5" />
              Contanti
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Toccando un metodo il pagamento è registrato e il trattamento
            risulta completato.
          </p>
        </div>
      )}
    </>
  );
}
