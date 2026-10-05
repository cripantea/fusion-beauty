"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/signature-pad";

import { signConsentFromLink } from "./actions";

type ConsentSignFormProps = {
  token: string;
  clientName: string;
  clientPhone: string;
  consentTitle: string;
  consentBody: string;
};

export function ConsentSignForm({
  token,
  clientName,
  clientPhone,
  consentTitle,
  consentBody,
}: ConsentSignFormProps) {
  const [signature, setSignature] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!signature) return;

    startTransition(async () => {
      const result = await signConsentFromLink(token, signature);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-mint-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint-soft text-mint-ink">
          <CheckCircle2 className="size-7" />
        </div>
        <h2 className="mt-4 font-heading text-2xl font-bold">Firmato!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Il tuo consenso è stato registrato. Grazie.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-mint-border bg-card p-5 shadow-sm">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-semibold">{clientName}</p>
        <p className="text-xs text-muted-foreground">{clientPhone}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {consentTitle}
        </p>
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 text-sm [overflow-wrap:anywhere]">
          {consentBody}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Firma qui</p>
        <SignaturePad onChange={setSignature} />
      </div>

      <Button
        type="button"
        size="lg"
        className="h-12 w-full text-base"
        disabled={isPending || !signature}
        onClick={handleSubmit}
      >
        {isPending ? "Salvataggio..." : "Firma e invia"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        La firma ha valore legale. Verrà conservata in modo sicuro.
      </p>
    </div>
  );
}
