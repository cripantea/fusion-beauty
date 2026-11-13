"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuro } from "@/lib/format";

import { sendPaymentLink, sendPaymentLinkWhatsapp } from "./actions";

export type PaymentLinkTarget = {
  clientId: string;
  clientFirstName: string;
  clientPhone: string;
  appointmentId?: string;
  /** Vuoto (dalla scheda cliente): l'importo va scritto. */
  amount?: number;
  description: string;
};

/** "1.200,50", "1200,5", "1200.50", "€ 80" → euro; NaN se non è un numero. */
export function parseEuroInput(raw: string): number {
  let value = raw.replace(/[€\s]/g, "");
  if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  return value === "" ? Number.NaN : Number(value);
}

/**
 * Crea (o riusa) il link di pagamento (Stripe del centro) e lo manda su
 * WhatsApp: la cliente paga con carta, Apple/Google Pay o anche in 3 rate, se disponibile.
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

type Done = { url: string; token: string; sent: boolean; fallbackUrl?: string; reused: boolean };

function Body({ target, onCreated }: { target: PaymentLinkTarget; onCreated?: (link: Created) => void }) {
  const [amount, setAmount] = useState(target.amount !== undefined ? target.amount.toFixed(2).replace(".", ",") : "");
  const [description, setDescription] = useState(target.description);
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const value = parseEuroInput(amount);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Link di pagamento</DialogTitle>
        <DialogDescription>
          La cliente paga online con carta, Apple Pay, Google Pay o anche in 3 rate (se disponibile). Quando paga, qui lo vedi da solo.
        </DialogDescription>
      </DialogHeader>
      {done ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={done.url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Copia link"
              onClick={() => {
                navigator.clipboard.writeText(done.url).then(() => {
                  setCopied(true);
                  toast.success("Link copiato.");
                });
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          {done.sent ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await sendPaymentLinkWhatsapp(done.token);
                  if (!result.success) toast.error(result.error);
                  else toast.success("Link inviato di nuovo su WhatsApp.");
                })
              }
            >
              <Check className="size-4" />
              Inviato su WhatsApp · rimanda
            </Button>
          ) : done.fallbackUrl ? (
            <Button className="w-full" nativeButton={false} render={<a href={done.fallbackUrl} target="_blank" rel="noopener noreferrer" />}>
              <MessageCircle className="size-4" />
              Apri WhatsApp con il messaggio
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Il link non scade. Le rate compaiono tra i metodi quando l&apos;importo e la cliente sono idonei.
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
            <Input inputMode="decimal" placeholder="es. 120,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={target.amount === undefined} />
            <p className="text-xs text-muted-foreground">Puoi cambiarlo per uno sconto o un pacchetto.</p>
          </div>
          <Button
            className="w-full"
            disabled={isPending || !(value >= 1) || !description.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await sendPaymentLink({
                  clientId: target.clientId,
                  appointmentId: target.appointmentId,
                  amount: value,
                  description,
                });
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                setDone({ url: result.url, token: result.token, sent: result.sent, fallbackUrl: result.fallbackUrl, reused: result.reused });
                onCreated?.({ token: result.token, amountCents: result.amountCents, appointmentId: target.appointmentId });
                if (result.sent) toast.success("Link inviato su WhatsApp.");
                else if (result.fallbackUrl) window.open(result.fallbackUrl, "_blank", "noopener,noreferrer");
              })
            }
          >
            <MessageCircle className="size-4" />
            Invia link da {Number.isFinite(value) ? formatEuro(value) : "—"}
          </Button>
        </div>
      )}
    </>
  );
}
