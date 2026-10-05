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
import { Textarea } from "@/components/ui/textarea";
import { formatEuro } from "@/lib/format";

import { registerPayment } from "./actions";

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentDTO | null;
  onPaid: (appointment: AppointmentDTO) => void;
  isAdmin?: boolean;
};

/** Incasso in un tap: importo precompilato col prezzo del trattamento, poi Carta/POS o Contanti. */
export function PaymentDialog({
  open,
  onOpenChange,
  appointment,
  onPaid,
  isAdmin = false,
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
          isAdmin={isAdmin}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentBody({
  appointment,
  onClose,
  onPaid,
  isAdmin,
}: {
  appointment: AppointmentDTO;
  onClose: () => void;
  onPaid: (appointment: AppointmentDTO) => void;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const servicePrice = Number(appointment.service.price);
  const [amount, setAmount] = useState(
    String(appointment.payment?.amount ?? servicePrice),
  );
  const [notes, setNotes] = useState(appointment.payment?.notes ?? "");
  const [discountOn, setDiscountOn] = useState(false);
  const [discountPct, setDiscountPct] = useState("");
  const [paid, setPaid] = useState<AppointmentDTO | null>(null);

  const parsedAmount = Number(amount.replace(",", "."));
  const validAmount =
    Number.isFinite(parsedAmount) && parsedAmount >= 0 && amount.trim() !== "";
  const amountDiffers = validAmount && Math.abs(parsedAmount - servicePrice) > 0.005;

  function applyDiscount(pct: string) {
    setDiscountPct(pct);
    const p = parseFloat(pct);
    if (Number.isFinite(p) && p >= 0 && p <= 100) {
      const discounted = servicePrice * (1 - p / 100);
      setAmount(String(Math.round(discounted * 100) / 100));
      if (p > 0) setNotes(`Sconto ${p}%`);
    }
  }

  function pay(method: "CARD" | "CASH") {
    if (!validAmount) return;
    startTransition(async () => {
      const result = await registerPayment({
        appointmentId: appointment.id,
        method,
        amount: parsedAmount,
        notes: notes.trim() || undefined,
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

          {/* Admin-only: discount toggle */}
          {isAdmin && (
            <div className="rounded-xl border border-mint-border bg-mint-soft/40 px-3 py-2.5">
              <label className="flex cursor-pointer items-center justify-between gap-2">
                <span className="text-xs font-semibold text-forest">Promozione / Sconto</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={discountOn}
                  onClick={() => {
                    const next = !discountOn;
                    setDiscountOn(next);
                    if (!next) {
                      setDiscountPct("");
                      setAmount(String(servicePrice));
                      setNotes("");
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    discountOn ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                      discountOn ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
              {discountOn && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPct}
                    onChange={(e) => applyDiscount(e.target.value)}
                    placeholder="0"
                    className="h-8 w-20 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">% di sconto</span>
                  {discountPct && Number(discountPct) > 0 && (
                    <span className="ml-auto text-xs font-semibold text-primary">
                      → {formatEuro(parsedAmount)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {amountDiffers && !discountOn && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Motivo variazione importo
                {parsedAmount < servicePrice ? ` (sconto di ${formatEuro(servicePrice - parsedAmount)})` : ` (extra di ${formatEuro(parsedAmount - servicePrice)})`}
              </label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Es. sconto fedeltà, trattamento aggiuntivo…"
                className="text-sm resize-none"
              />
            </div>
          )}

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
