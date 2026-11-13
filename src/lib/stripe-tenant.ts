import "server-only";

import Stripe from "stripe";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { openSecret, sealSecret } from "@/lib/secret-box";

/**
 * Stripe del centro: ogni centro collega il proprio account con una chiave
 * ristretta (Checkout Sessions e Webhook Endpoints in scrittura). Il webhook
 * lo crea Fusion Beauty via API, così sul pannello Stripe non serve altro.
 * Chiave e segreto del webhook stanno nel database cifrati (secret-box.ts).
 */

export const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
];

type StoredCredentials = {
  key: string;
  webhookSecret: string | null;
  webhookEndpointId: string | null;
  livemode: boolean;
  keyHint: string;
  connectedAt: string;
};

export type StripeStatus =
  | { connected: false }
  | { connected: true; livemode: boolean; keyHint: string; connectedAt: string; webhook: boolean };

function baseUrl() {
  return (process.env.APP_BASE_URL ?? "https://beauty.fusionsoft.it").replace(/\/$/, "");
}

function client(key: string) {
  return new Stripe(key, { appInfo: { name: "Fusion Beauty", url: "https://beauty.fusionsoft.it" }, maxNetworkRetries: 2 });
}

async function credentials(tenantId: string): Promise<StoredCredentials | null> {
  const row = await prisma.tenantIntegration.findUnique({ where: { tenantId_type: { tenantId, type: "STRIPE" } } });
  if (!row?.isEnabled || !row.credentials) return null;
  return row.credentials as unknown as StoredCredentials;
}

export async function getStripeStatus(tenantId: string): Promise<StripeStatus> {
  const stored = await credentials(tenantId);
  if (!stored) return { connected: false };
  return { connected: true, livemode: stored.livemode, keyHint: stored.keyHint, connectedAt: stored.connectedAt, webhook: Boolean(stored.webhookSecret) };
}

/** Client Stripe del centro, o null se non collegato. */
export async function stripeFor(tenantId: string): Promise<Stripe | null> {
  const stored = await credentials(tenantId);
  return stored ? client(openSecret(stored.key)) : null;
}

export async function webhookSecretFor(tenantId: string): Promise<string | null> {
  const stored = await credentials(tenantId);
  return stored?.webhookSecret ? openSecret(stored.webhookSecret) : null;
}

function explain(err: unknown): string {
  if (err instanceof Stripe.errors.StripeAuthenticationError) return "Stripe non riconosce la chiave: ricopiala dal pannello Stripe.";
  if (err instanceof Stripe.errors.StripePermissionError) {
    return "La chiave non ha i permessi necessari: servono “Checkout Sessions” e “Webhook Endpoints” in scrittura.";
  }
  if (err instanceof Stripe.errors.StripeError) return err.message;
  return err instanceof Error ? err.message : "Errore di Stripe.";
}

/** Verifica la chiave, crea il webhook del centro e salva tutto cifrato. */
export async function connectStripe(tenantId: string, rawKey: string): Promise<{ ok: true; webhook: boolean } | { ok: false; error: string }> {
  const key = rawKey.trim();
  if (!/^(rk|sk)_(live|test)_[A-Za-z0-9]+$/.test(key)) {
    return { ok: false, error: "La chiave deve iniziare con rk_live_ (chiave ristretta) o sk_live_." };
  }
  const stripe = client(key);
  try {
    await stripe.checkout.sessions.list({ limit: 1 });
  } catch (err) {
    return { ok: false, error: explain(err) };
  }

  const previous = await credentials(tenantId);
  const url = `${baseUrl()}/api/webhooks/stripe/${tenantId}`;
  let webhookSecret: string | null = null;
  let webhookEndpointId: string | null = null;

  // Webhook raggiungibile solo da un indirizzo pubblico https (non in locale).
  if (url.startsWith("https://")) {
    try {
      // Un webhook per centro: quelli vecchi verso lo stesso indirizzo si tolgono.
      const existing = await stripe.webhookEndpoints.list({ limit: 100 });
      for (const endpoint of existing.data) {
        if (endpoint.url === url || endpoint.id === previous?.webhookEndpointId) await stripe.webhookEndpoints.del(endpoint.id);
      }
      const endpoint = await stripe.webhookEndpoints.create({
        url,
        enabled_events: WEBHOOK_EVENTS,
        description: "Fusion Beauty: pagamenti dei trattamenti",
      });
      webhookSecret = endpoint.secret ?? null;
      webhookEndpointId = endpoint.id;
    } catch (err) {
      return { ok: false, error: `Chiave valida, ma il webhook non si è potuto creare: ${explain(err)}` };
    }
  }

  const stored: StoredCredentials = {
    key: sealSecret(key),
    webhookSecret: webhookSecret ? sealSecret(webhookSecret) : null,
    webhookEndpointId,
    livemode: key.includes("_live_"),
    keyHint: `${key.slice(0, 8)}…${key.slice(-4)}`,
    connectedAt: new Date().toISOString(),
  };
  await prisma.tenantIntegration.upsert({
    where: { tenantId_type: { tenantId, type: "STRIPE" } },
    create: { tenantId, type: "STRIPE", isEnabled: true, credentials: stored as unknown as Prisma.InputJsonValue },
    update: { isEnabled: true, credentials: stored as unknown as Prisma.InputJsonValue },
  });
  return { ok: true, webhook: Boolean(webhookSecret) };
}

export async function disconnectStripe(tenantId: string): Promise<void> {
  const stored = await credentials(tenantId);
  if (stored?.webhookEndpointId) {
    try {
      await client(openSecret(stored.key)).webhookEndpoints.del(stored.webhookEndpointId);
    } catch {
      // Chiave già revocata su Stripe: si scollega comunque qui.
    }
  }
  await prisma.tenantIntegration.deleteMany({ where: { tenantId, type: "STRIPE" } });
}

/**
 * Pagina Stripe ancora aperta per questa sessione (stesso link riaperto più
 * volte = stessa sessione, niente doppi pagamenti). "paid" se la sessione è già
 * stata pagata e il webhook non è ancora arrivato.
 */
export async function reusableCheckoutUrl(tenantId: string, sessionId: string): Promise<{ url: string } | "paid" | null> {
  const stripe = await stripeFor(tenantId);
  if (!stripe) return null;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "complete") return "paid";
    // Almeno 5 minuti di margine per completare il pagamento.
    if (session.status === "open" && session.url && session.expires_at > Date.now() / 1000 + 5 * 60) return { url: session.url };
  } catch {
    // Sessione sparita o chiave cambiata: se ne crea una nuova.
  }
  return null;
}

/**
 * Chiude su Stripe la pagina di pagamento di un link annullato o sostituito,
 * così la cliente non può più pagarlo. "paid" se nel frattempo ha già pagato.
 */
export async function expireCheckoutSession(tenantId: string, sessionId: string | null): Promise<"expired" | "paid" | "none"> {
  if (!sessionId) return "none";
  const stripe = await stripeFor(tenantId);
  if (!stripe) return "none";
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "complete") return "paid";
    if (session.status !== "open") return "none";
    await stripe.checkout.sessions.expire(sessionId);
    return "expired";
  } catch (err) {
    // Pagata proprio in questo istante: Stripe rifiuta la chiusura.
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "complete") return "paid";
    } catch {
      // ignorato
    }
    console.error("[stripe] expire checkout session", sessionId, err);
    return "none";
  }
}

/** Checkout Session per un link di pagamento (carta, rate con Klarna se attivo e disponibile sullo Stripe del centro). */
export async function createCheckoutSession(link: {
  id: string;
  tenantId: string;
  token: string;
  amountCents: number;
  description: string;
  email: string | null;
}): Promise<{ ok: true; url: string; sessionId: string } | { ok: false; error: string }> {
  const stripe = await stripeFor(link.tenantId);
  if (!stripe) return { ok: false, error: "Il centro non ha ancora collegato Stripe." };
  const page = `${baseUrl()}/paga/${link.token}`;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "it",
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: link.amountCents, product_data: { name: link.description } } }],
      success_url: `${page}?esito=ok`,
      cancel_url: page,
      client_reference_id: link.id,
      customer_email: link.email ?? undefined,
      metadata: { paymentLinkId: link.id, tenantId: link.tenantId },
      payment_intent_data: { description: link.description, metadata: { paymentLinkId: link.id, tenantId: link.tenantId } },
      // 2 ore: entro questo tempo chi riapre il link ritrova la stessa pagina; dopo, una nuova.
      expires_at: Math.floor(Date.now() / 1000) + 2 * 60 * 60,
    });
    if (!session.url) return { ok: false, error: "Stripe non ha restituito la pagina di pagamento." };
    return { ok: true, url: session.url, sessionId: session.id };
  } catch (err) {
    return { ok: false, error: explain(err) };
  }
}
