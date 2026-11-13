"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createCheckoutSession, expireCheckoutSession, reusableCheckoutUrl } from "@/lib/stripe-tenant";

/**
 * Pagina pubblica: riapre la pagina Stripe già creata per questo link se è
 * ancora aperta (così un doppio clic non porta a due pagamenti); altrimenti ne
 * crea una nuova, così il link non scade.
 */
export async function startPayment(token: string): Promise<{ error: string }> {
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: { client: { select: { email: true } }, tenant: { select: { isActive: true } } },
  });
  if (!link || !link.tenant.isActive || link.status !== "PENDING") return { error: "Questo link di pagamento non è più attivo." };

  if (link.stripeSessionId) {
    const existing = await reusableCheckoutUrl(link.tenantId, link.stripeSessionId);
    if (existing === "paid") return { error: "Il pagamento risulta già fatto: la conferma arriva al centro tra pochi secondi." };
    if (existing) redirect(existing.url);
  }

  const session = await createCheckoutSession({
    id: link.id,
    tenantId: link.tenantId,
    token: link.token,
    amountCents: link.amountCents,
    description: link.description,
    email: link.client.email,
  });
  if (!session.ok) return { error: "Il pagamento online non è disponibile al momento. Contatta il centro." };

  // Due clic quasi insieme: vince il primo, la sessione dell'altro si chiude.
  const saved = await prisma.paymentLink.updateMany({
    where: { id: link.id, status: "PENDING", stripeSessionId: link.stripeSessionId },
    data: { stripeSessionId: session.sessionId },
  });
  if (saved.count === 0) {
    await expireCheckoutSession(link.tenantId, session.sessionId);
    const current = await prisma.paymentLink.findUnique({ where: { id: link.id }, select: { status: true, stripeSessionId: true } });
    if (current?.status !== "PENDING" || !current.stripeSessionId) return { error: "Questo link di pagamento non è più attivo." };
    const winner = await reusableCheckoutUrl(link.tenantId, current.stripeSessionId);
    if (winner === "paid") return { error: "Il pagamento risulta già fatto: la conferma arriva al centro tra pochi secondi." };
    if (!winner) return { error: "Riprova tra qualche secondo." };
    redirect(winner.url);
  }
  // La vecchia sessione (scaduta o quasi) non deve restare pagabile.
  if (link.stripeSessionId) await expireCheckoutSession(link.tenantId, link.stripeSessionId);
  redirect(session.url);
}
