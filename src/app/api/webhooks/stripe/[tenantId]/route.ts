import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { stripeFor, webhookSecretFor } from "@/lib/stripe-tenant";

/**
 * Webhook dello Stripe di un centro (creato da Fusion Beauty al collegamento,
 * uno per centro). La firma si verifica con il segreto di quel webhook.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const secret = await webhookSecretFor(tenantId);
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook non configurato" }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Firma non valida" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    // Bonifici e simili: "completed" arriva prima dei soldi, si aspetta async_payment_succeeded.
    if (session.payment_status === "paid" || event.type === "checkout.session.async_payment_succeeded") {
      await markPaid(tenantId, session);
    }
  }
  // checkout.session.async_payment_failed: il link resta da pagare, la cliente può riprovare.

  return NextResponse.json({ received: true });
}

async function markPaid(tenantId: string, session: Stripe.Checkout.Session) {
  const linkId = session.metadata?.paymentLinkId ?? session.client_reference_id;
  if (!linkId) return;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  // Metodo usato (carta, klarna…): serve il permesso di lettura dei PaymentIntent; senza, si salta.
  let paidWith: string | null = null;
  if (paymentIntentId) {
    try {
      const stripe = await stripeFor(tenantId);
      const intent = await stripe?.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
      const charge = intent?.latest_charge;
      paidWith = charge && typeof charge !== "string" ? (charge.payment_method_details?.type ?? null) : null;
    } catch {
      paidWith = null;
    }
  }

  const link = await prisma.paymentLink.findFirst({
    where: { id: linkId, tenantId },
    select: { id: true, status: true, clientId: true, appointmentId: true, planId: true, amountCents: true, description: true },
  });
  if (!link || link.status === "PAID") return;
  if (link.status === "CANCELLED") {
    // Non dovrebbe succedere (la pagina Stripe si chiude quando il link si annulla),
    // ma i soldi sono arrivati: si registra comunque come pagato.
    console.warn(`[stripe] link annullato ${link.id} pagato comunque (sessione ${session.id}): registrato come pagato.`);
  }

  const notes = `Pagato online con Stripe${paidWith ? ` (${paidWith})` : ""}`;
  const markPaid = {
    where: { id: link.id, tenantId, status: { not: "PAID" as const } },
    data: { status: "PAID" as const, paidAt: new Date(), stripeSessionId: session.id, stripePaymentId: paymentIntentId, paidWith },
  };

  // Rata di un percorso: link pagato, incasso e somma al percorso insieme (o niente:
  // se qualcosa non va Stripe ritenta). Il percorso non supera mai il suo totale.
  if (link.planId) {
    const planId = link.planId;
    await prisma.$transaction(async (tx) => {
      const updated = await tx.paymentLink.updateMany(markPaid);
      if (updated.count === 0) return;
      const plan = await tx.clientPlan.findUnique({ where: { id: planId }, select: { totalPrice: true, paidAmount: true } });
      const paid = link.amountCents / 100;
      const remaining = plan ? Math.max(0, Math.round((plan.totalPrice.toNumber() - plan.paidAmount.toNumber()) * 100) / 100) : 0;
      const credit = Math.min(paid, remaining);
      await tx.payment.create({
        data: {
          tenantId,
          clientId: link.clientId,
          planId,
          amount: paid,
          method: "CARD",
          notes: credit < paid ? `${notes} · ${(paid - credit).toFixed(2).replace(".", ",")} € oltre il totale del percorso` : notes,
        },
      });
      if (credit > 0) await tx.clientPlan.update({ where: { id: planId }, data: { paidAmount: { increment: credit } } });
    });
    return;
  }

  const updated = await prisma.paymentLink.updateMany(markPaid);
  if (updated.count === 0) return;

  if (!link.appointmentId) return;

  // Incasso dell'appuntamento: sparisce "Incassa" e il pagamento entra nelle statistiche.
  // Se era già stato incassato in cassa non si tocca (si vede comunque il link pagato).
  const existing = await prisma.payment.findUnique({ where: { appointmentId: link.appointmentId }, select: { id: true } });
  if (existing) {
    console.warn(`[stripe] appuntamento ${link.appointmentId} già incassato in cassa e pagato anche online (link ${link.id}).`);
    return;
  }
  try {
    await prisma.payment.create({
      data: {
        tenantId,
        clientId: link.clientId,
        appointmentId: link.appointmentId,
        amount: link.amountCents / 100,
        // Non c'è un metodo "online": carta è il più vicino (anche per Klarna e simili).
        method: "CARD",
        notes,
      },
    });
  } catch (err) {
    // Incasso registrato nello stesso istante dalla cassa (appointmentId univoco).
    if ((err as { code?: string }).code !== "P2002") throw err;
  }
}
