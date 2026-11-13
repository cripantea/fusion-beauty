import { CheckCircle2, CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { PayButton } from "./pay-button";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ esito?: string }> };

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/** Link di pagamento inviato alla cliente (WhatsApp): trattamento, importo e pulsante verso Stripe. */
export default async function PayPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { esito } = await searchParams;
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: {
      tenant: { select: { name: true, logoUrl: true, isActive: true } },
      client: { select: { firstName: true } },
    },
  });
  if (!link || !link.tenant.isActive) notFound();

  const paid = link.status === "PAID";
  // Appena tornata da Stripe il webhook può arrivare qualche secondo dopo.
  const justPaid = !paid && esito === "ok";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-3xl border bg-card p-8 text-center shadow-sm">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{link.tenant.name}</p>
          <h1 className="text-2xl font-bold">Ciao {link.client.firstName}</h1>
        </div>
        <div className="space-y-1 rounded-2xl bg-muted/50 p-5">
          <p className="text-sm text-muted-foreground">{link.description}</p>
          <p className="text-3xl font-bold">{euro.format(link.amountCents / 100)}</p>
        </div>

        {paid || justPaid ? (
          <div className="space-y-2">
            <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
            <p className="font-semibold">{paid ? "Pagamento ricevuto, grazie!" : "Pagamento inviato, grazie!"}</p>
            <p className="text-sm text-muted-foreground">
              {paid ? "Non devi fare altro." : "La conferma arriva al centro tra pochi secondi."}
            </p>
          </div>
        ) : link.status === "CANCELLED" ? (
          <p className="text-sm text-muted-foreground">Questo link non è più attivo. Per pagare contatta il centro.</p>
        ) : (
          <div className="space-y-3">
            <PayButton token={link.token} />
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <CreditCard className="size-3.5" />
              Carta, Apple Pay, Google Pay o anche in 3 rate (se disponibile). Pagamento sicuro con Stripe.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
