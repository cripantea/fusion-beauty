"use client";

import { CheckCircle2, CreditCard, ExternalLink, KeyRound, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StripeStatus } from "@/lib/stripe-tenant";

import { removeStripe, saveStripeKey } from "./actions";

const PERMISSIONS = [
  ["Checkout Sessions", "Scrittura"],
  ["Webhook Endpoints", "Scrittura"],
  ["Payment Intents", "Lettura (facoltativo: per sapere se ha pagato con carta o Klarna)"],
  ["Charges", "Lettura (facoltativo, come sopra)"],
];

export function StripeSettings({ status }: { status: StripeStatus }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Impostazioni"
        title="Pagamenti online"
        description="Collega lo Stripe del centro: dall'agenda mandi alla cliente un link per pagare il trattamento con carta, Apple Pay, Google Pay o in 3 rate con Klarna."
      />

      <Panel title="Stripe" icon={CreditCard}>
        <div className="space-y-4 p-5 text-sm">
          {status.connected ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <CheckCircle2 className="size-5 text-mint-ink" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    Stripe collegato
                    <Pill tone={status.livemode ? "mint" : "amber"}>{status.livemode ? "Live" : "Prova"}</Pill>
                  </div>
                  <div className="text-muted-foreground">
                    Chiave <span className="font-mono">{status.keyHint}</span> ·{" "}
                    {status.webhook ? "conferme automatiche dei pagamenti attive" : "webhook non creato: i pagamenti non si segnano da soli"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeStripe();
                      toast.success("Stripe scollegato.");
                      router.refresh();
                    })
                  }
                >
                  <Unplug className="size-3.5" />
                  Scollega
                </Button>
              </div>
              <p className="text-muted-foreground">
                Per mandare un link: apri un appuntamento in{" "}
                <Link href="/dashboard/calendar" className="underline">
                  Agenda
                </Link>{" "}
                → “Link di pagamento”. Trovi tutti i link in{" "}
                <Link href="/dashboard/payment-links" className="underline">
                  Link di pagamento
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                <li>
                  Su Stripe apri{" "}
                  <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">
                    Sviluppatori → Chiavi API <ExternalLink className="size-3" />
                  </a>{" "}
                  → “Crea chiave limitata” e chiamala “Fusion Beauty”.
                </li>
                <li>Dai questi permessi (tutti gli altri restano “Nessuno”):</li>
              </ol>
              <table className="ml-5 text-xs">
                <tbody>
                  {PERMISSIONS.map(([name, level]) => (
                    <tr key={name}>
                      <td className="py-0.5 pr-4 font-medium">{name}</td>
                      <td className="py-0.5 text-muted-foreground">{level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ol start={3} className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                <li>Copia la chiave (inizia con rk_live_) e incollala qui sotto. Il webhook per le conferme lo crea Fusion Beauty da solo.</li>
                <li>Su Stripe → Impostazioni → Metodi di pagamento tieni attivo Klarna per il pagamento in 3 rate.</li>
              </ol>
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  startTransition(async () => {
                    const result = await saveStripeKey(key);
                    if (!result.success) {
                      toast.error(result.error);
                      return;
                    }
                    setKey("");
                    toast.success(result.webhook ? "Stripe collegato." : "Stripe collegato, ma senza webhook (indirizzo non pubblico).");
                    router.refresh();
                  });
                }}
              >
                <div className="relative min-w-64 flex-1">
                  <KeyRound className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    autoComplete="off"
                    className="pl-8 font-mono"
                    placeholder="rk_live_…"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isPending || !key.trim()}>
                  {isPending ? "Verifica…" : "Collega Stripe"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">La chiave è salvata cifrata e non si può più rileggere da qui.</p>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
