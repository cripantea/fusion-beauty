"use client";

import { Copy, Receipt, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/format";

import { cancelPaymentLink } from "./actions";

type LinkRow = {
  token: string;
  url: string;
  status: "PENDING" | "PAID" | "CANCELLED";
  amountCents: number;
  description: string;
  paidWith: string | null;
  createdAt: string;
  paidAt: string | null;
  client: { id: string; name: string; phone: string };
};

const STATUS = {
  PENDING: { label: "Da pagare", tone: "amber" },
  PAID: { label: "Pagato", tone: "mint" },
  CANCELLED: { label: "Annullato", tone: "slate" },
} as const;

const PAID_WITH: Record<string, string> = { card: "carta", klarna: "Klarna (rate)", satispay: "Satispay", link: "Link", paypal: "PayPal" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function PaymentLinksManager({ connected, links }: { connected: boolean; links: LinkRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const paid = links.filter((l) => l.status === "PAID").reduce((sum, l) => sum + l.amountCents, 0);
  const pending = links.filter((l) => l.status === "PENDING").reduce((sum, l) => sum + l.amountCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pagamenti online"
        title="Link di pagamento"
        description="I link mandati alle clienti per pagare online (anche in 3 rate con Klarna). Si crea dall'appuntamento in agenda."
      />
      {!connected ? (
        <p className="rounded-xl border border-amber-200 bg-amber-soft px-4 py-3 text-sm text-amber-ink">
          Stripe non è collegato.{" "}
          <Link href="/dashboard/integrations/stripe" className="font-medium underline">
            Collega Stripe
          </Link>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-mint-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Pagati online</div>
          <div className="mt-1 text-2xl font-bold">{formatEuro(paid / 100)}</div>
        </div>
        <div className="rounded-2xl border border-mint-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">In attesa</div>
          <div className="mt-1 text-2xl font-bold">{formatEuro(pending / 100)}</div>
        </div>
      </div>
      <Panel title="Link" icon={Receipt}>
        {links.length === 0 ? (
          <EmptyState>Nessun link ancora. Apri un appuntamento in agenda → “Link di pagamento”.</EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/70">
            {links.map((l) => (
              <li key={l.token} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/clients/${l.client.id}`} className="font-medium hover:underline">
                    {l.client.name}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {l.description} · creato {formatDate(l.createdAt)}
                    {l.paidAt ? ` · pagato ${formatDate(l.paidAt)}${l.paidWith ? ` con ${PAID_WITH[l.paidWith] ?? l.paidWith}` : ""}` : ""}
                  </div>
                </div>
                <span className="font-semibold">{formatEuro(l.amountCents / 100)}</span>
                <Pill tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Pill>
                {l.status === "PENDING" ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Copia link"
                      onClick={() => navigator.clipboard.writeText(l.url).then(() => toast.success("Link copiato."))}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Annulla link"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await cancelPaymentLink(l.token);
                          if (!result.success) toast.error(result.error);
                          else {
                            toast.success("Link annullato: non si può più pagare.");
                            router.refresh();
                          }
                        })
                      }
                    >
                      <X className="size-4 text-destructive" />
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
