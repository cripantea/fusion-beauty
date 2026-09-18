"use client";

import { useState, useTransition } from "react";
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
import { cn } from "@/lib/utils";

import { createPayment, type PaymentMethodValue } from "./actions";
import { PAYMENT_METHOD_LABELS } from "./constants";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const methodIcons: Record<PaymentMethodValue, string> = {
  CASH: "💵",
  CARD: "💳",
  TRANSFER: "🏦",
  OTHER: "•••",
};

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    client: { firstName: string; lastName: string };
    service: { name: string };
    price: number | null;
  } | null;
  onSuccess: () => void;
};

type PosState = "idle" | "sending" | "approved";

export function PaymentDialog({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodValue | null>(null);
  const [posState, setPosState] = useState<PosState>("idle");
  const [isPending, startTransition] = useTransition();

  if (!appointment) return null;
  const apt = appointment;
  const amount = apt.price ?? 0;

  function resetState() {
    setSelectedMethod(null);
    setPosState("idle");
  }

  function handleOpenChange(open: boolean) {
    if (!open) resetState();
    onOpenChange(open);
  }

  function handleMethodSelect(method: PaymentMethodValue) {
    setSelectedMethod(method);
    setPosState("idle");
  }

  function handleConfirm() {
    if (!selectedMethod) return;

    if (selectedMethod === "CARD" && posState === "idle") {
      setPosState("sending");
      setTimeout(() => {
        setPosState("approved");
      }, 2000);
      return;
    }

    startTransition(async () => {
      const result = await createPayment({
        appointmentId: apt.id,
        method: selectedMethod,
        amount,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Pagamento di ${currencyFormatter.format(amount)} registrato.`);
      resetState();
      onOpenChange(false);
      onSuccess();
    });
  }

  const canConfirm =
    selectedMethod !== null &&
    (selectedMethod !== "CARD" || posState === "approved");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Incassa pagamento</DialogTitle>
          <DialogDescription>
            {apt.client.firstName} {apt.client.lastName} —{" "}
            {apt.service.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-muted p-4">
            <span className="text-sm text-muted-foreground">Importo</span>
            <span className="text-2xl font-bold">{currencyFormatter.format(amount)}</span>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Metodo di pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethodValue[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => handleMethodSelect(method)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                    selectedMethod === method
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  <span className="text-base">{methodIcons[method]}</span>
                  {PAYMENT_METHOD_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          {selectedMethod === "CARD" && posState !== "idle" && (
            <div
              className={cn(
                "rounded-lg border p-3 text-center text-sm",
                posState === "sending" && "border-amber-300 bg-amber-50 text-amber-800",
                posState === "approved" && "border-green-300 bg-green-50 text-green-800"
              )}
            >
              {posState === "sending" && (
                <div className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">●</span>
                  Invio {currencyFormatter.format(amount)} al POS...
                </div>
              )}
              {posState === "approved" && (
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="outline" className="border-green-600 text-green-700">
                    ✓ Pagamento approvato
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annulla
          </Button>
          {selectedMethod === "CARD" && posState === "idle" ? (
            <Button onClick={handleConfirm} disabled={isPending}>
              Invia al POS
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={!canConfirm || isPending}>
              {isPending ? "Registrazione..." : "Conferma incasso"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
