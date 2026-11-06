"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Blocco di codice da incollare in un sito, con pulsante Copia. */
export function CopyCode({ code, label = "Copia codice" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        toast.success("Codice copiato: incollalo nel sito dove vuoi che compaia.");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Impossibile copiare il codice."));
  }

  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-xl border border-mint-border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-forest">
        {code}
      </pre>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copiato" : label}
      </Button>
    </div>
  );
}
