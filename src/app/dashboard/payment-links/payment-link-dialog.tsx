"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuro, whatsappUrl } from "@/lib/format";

import { createPaymentLink } from "./actions";

export type PaymentLinkTarget = {
  clientId: string;
  clientFirstName: string;
  clientPhone: string;
  appointmentId?: string;
  amount: number;
  description: string;
};

/**
 * Crea il link di pagamento (Stripe del centro) e lo manda su WhatsApp: la
 * cliente paga con carta, Apple/Google Pay o in 3 rate con Klarna.
 */
type Created = { token: string; amountCents: number; appointmentId?: string };

export function PaymentLinkDialog({ target, onClose, onCreated }: { target: PaymentLinkTarget | null; onClose: () => void; onCreated?: (link: Created) => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {target ? <Body key={`${target.clientId}-${target.appointmentId ?? ""}`} target={target} onCreated={onCreated} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({ target, onCreated }: { target: PaymentLinkTarget; onCreated?: (link: Created) => void }) {
  const [amount, setAmount] = useState(String(target.amount.toFixed(2)).replace(".", ","));
  const [description, setDescription] = useState(target.description);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const value = Number(amount.replace(",", "."));

  const message = url
    ? `Ciao ${target.clientFirstName}, ecco il link per pagare ${description} (${formatEuro(value)}). Puoi pagare con carta o in 3 rate senza interessi con Klarna: ${url}`
    : "";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Link di pagamento</DialogTitle>
        <DialogDescription>
          La cliente paga online con carta, Apple Pay, Google Pay o in 3 rate con Klarna. Quando paga, qui lo vedi da solo.
        </DialogDescription>
      </DialogHeader>
      {url ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Copia link"
              onClick={() => {
                navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  toast.success("Link copiato.");
                });
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <Button className="w-full" nativeButton={false} render={<a href={whatsappUrl(target.clientPhone, message)} target="_blank" rel="noopener noreferrer" />}>
            <MessageCircle className="size-4" />
            Invia su WhatsApp
          </Button>
          <p className="text-xs text-muted-foreground">
            Il link non scade. Klarna compare tra i metodi quando l&apos;importo e la cliente sono idonei.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Per cosa paga (lo vede la cliente)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Importo (€)</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-xs text-muted-foreground">Puoi cambiarlo per uno sconto o un pacchetto.</p>
          </div>
          <Button
            className="w-full"
            disabled={isPending || !(value >= 1) || !description.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await createPaymentLink({
                  clientId: target.clientId,
                  appointmentId: target.appointmentId,
                  amount: value,
                  description,
                });
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                setUrl(result.url);
                onCreated?.({ token: result.token, amountCents: Math.round(value * 100), appointmentId: target.appointmentId });
              })
            }
          >
            Crea link da {Number.isFinite(value) ? formatEuro(value) : "—"}
          </Button>
        </div>
      )}
    </>
  );
}
