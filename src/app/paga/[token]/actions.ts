"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe-tenant";

/** Pagina pubblica: crea una sessione Stripe nuova a ogni clic, così il link non scade. */
export async function startPayment(token: string): Promise<{ error: string }> {
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: { client: { select: { email: true } }, tenant: { select: { isActive: true } } },
  });
  if (!link || !link.tenant.isActive || link.status !== "PENDING") return { error: "Questo link di pagamento non è più attivo." };

  const session = await createCheckoutSession({
    id: link.id,
    tenantId: link.tenantId,
    token: link.token,
    amountCents: link.amountCents,
    description: link.description,
    email: link.client.email,
  });
  if (!session.ok) return { error: "Il pagamento online non è disponibile al momento. Contatta il centro." };
  await prisma.paymentLink.update({ where: { id: link.id }, data: { stripeSessionId: session.sessionId } });
  redirect(session.url);
}
