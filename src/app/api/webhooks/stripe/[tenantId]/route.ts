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

  await prisma.paymentLink.updateMany({
    where: { id: linkId, tenantId, status: { not: "PAID" } },
    data: { status: "PAID", paidAt: new Date(), stripeSessionId: session.id, stripePaymentId: paymentIntentId, paidWith },
  });
}
