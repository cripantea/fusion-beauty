"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getBaseUrl } from "@/lib/app-url";
import { getTenantContext } from "@/lib/auth-context";
import { whatsappUrl } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { listTemplates } from "@/lib/fusion-wa";
import { expireCheckoutSession, getStripeStatus } from "@/lib/stripe-tenant";
import { hasActiveWhatsapp, sendWhatsappTemplate } from "@/lib/whatsapp";

const amountSchema = z.number().finite().min(1, "L'importo minimo è 1 €").max(20_000, "Importo troppo alto");

const createSchema = z.object({
  clientId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  /** Euro, con i centesimi (es. 120.50). */
  amount: amountSchema,
  description: z.string().trim().min(1, "Scrivi per cosa paga").max(200),
});

const sendSchema = z.object({
  appointmentId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  amount: amountSchema.optional(),
  description: z.string().trim().max(200).optional(),
});

export type PaymentLinkResult =
  | { success: true; url: string; token: string; amountCents: number; reused: boolean }
  | { success: false; error: string };

export type SendPaymentLinkResult =
  | {
      success: true;
      url: string;
      token: string;
      amountCents: number;
      reused: boolean;
      /** Inviato dal numero WhatsApp del centro. */
      sent: boolean;
      /** Se non inviato: wa.me con il messaggio già scritto, da aprire sul telefono. */
      fallbackUrl?: string;
    }
  | { success: false; error: string };

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dayFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "Europe/Rome" });

type LinkWithClient = {
  id: string;
  token: string;
  amountCents: number;
  description: string;
  client: { id: string; firstName: string; phone: string };
};

const linkSelect = {
  id: true,
  token: true,
  amountCents: true,
  description: true,
  client: { select: { id: true, firstName: true, phone: true } },
} as const;

/**
 * Link da mandare: se per lo stesso appuntamento (o la stessa cliente, senza
 * appuntamento) c'è già un link da pagare con lo stesso importo, si riusa quello.
 * Con un importo diverso il vecchio si annulla e la sua pagina Stripe si chiude.
 */
async function ensureLink(
  tenantId: string,
  userId: string,
  input: { clientId: string; appointmentId?: string; amountCents: number; description: string }
): Promise<{ ok: true; link: LinkWithClient; reused: boolean } | { ok: false; error: string }> {
  const stripe = await getStripeStatus(tenantId);
  if (!stripe.connected) return { ok: false, error: "Collega prima Stripe (Impostazioni → Pagamenti online)." };
  if (!stripe.webhook) {
    return {
      ok: false,
      error: "Stripe è collegato ma senza conferma automatica dei pagamenti: ricollega Stripe da Impostazioni → Pagamenti online.",
    };
  }

  const client = await prisma.client.findFirst({ where: { id: input.clientId, tenantId }, select: { id: true } });
  if (!client) return { ok: false, error: "Cliente non trovata." };

  if (input.appointmentId) {
    const appointment = await prisma.appointment.findFirst({ where: { id: input.appointmentId, tenantId, clientId: client.id }, select: { id: true } });
    if (!appointment) return { ok: false, error: "Appuntamento non trovato." };
    const paid = await prisma.paymentLink.findFirst({ where: { appointmentId: appointment.id, status: "PAID" }, select: { id: true } });
    if (paid) return { ok: false, error: "Questo appuntamento è già stato pagato online." };

    const pending = await prisma.paymentLink.findMany({
      where: { tenantId, appointmentId: appointment.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { ...linkSelect, stripeSessionId: true },
    });
    const same = pending.find((l) => l.amountCents === input.amountCents);
    if (same) {
      // Gli altri (importi vecchi) non devono restare pagabili.
      for (const old of pending) if (old.id !== same.id) await cancelLink(tenantId, old);
      return { ok: true, link: same, reused: true };
    }
    for (const old of pending) {
      const cancelled = await cancelLink(tenantId, old);
      if (!cancelled) return { ok: false, error: "La cliente ha appena pagato il link precedente: aspetta qualche secondo e ricarica." };
    }
  } else {
    const same = await prisma.paymentLink.findFirst({
      where: { tenantId, clientId: client.id, appointmentId: null, status: "PENDING", amountCents: input.amountCents, description: input.description },
      orderBy: { createdAt: "desc" },
      select: linkSelect,
    });
    if (same) return { ok: true, link: same, reused: true };
  }

  const link = await prisma.paymentLink.create({
    data: {
      tenantId,
      clientId: client.id,
      appointmentId: input.appointmentId ?? null,
      amountCents: input.amountCents,
      description: input.description,
      token: randomBytes(18).toString("base64url"),
      createdById: userId,
    },
    select: linkSelect,
  });
  return { ok: true, link, reused: false };
}

/** Annulla un link da pagare chiudendo prima la pagina Stripe. false se la cliente l'ha appena pagato. */
async function cancelLink(tenantId: string, link: { id: string; stripeSessionId: string | null }): Promise<boolean> {
  const expired = await expireCheckoutSession(tenantId, link.stripeSessionId);
  if (expired === "paid") return false;
  await prisma.paymentLink.updateMany({ where: { id: link.id, tenantId, status: "PENDING" }, data: { status: "CANCELLED" } });
  return true;
}

function revalidateLinks(clientId?: string) {
  revalidatePath("/dashboard/payment-links");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function createPaymentLink(values: z.input<typeof createSchema>): Promise<PaymentLinkResult> {
  const { tenantId, user } = await getTenantContext();
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const result = await ensureLink(tenantId, user.id, {
    clientId: parsed.data.clientId,
    appointmentId: parsed.data.appointmentId,
    amountCents: Math.round(parsed.data.amount * 100),
    description: parsed.data.description,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidateLinks(parsed.data.clientId);
  const { link } = result;
  return { success: true, url: `${await getBaseUrl()}/paga/${link.token}`, token: link.token, amountCents: link.amountCents, reused: result.reused };
}

/**
 * Un tocco: prepara il link (riusa quello da pagare, se c'è) e lo manda alla
 * cliente dal WhatsApp del centro. Senza WhatsApp collegato o senza template
 * approvato restituisce il link wa.me con il messaggio già scritto.
 * Dall'appuntamento importo e descrizione arrivano dal trattamento.
 */
export async function sendPaymentLink(values: z.input<typeof sendSchema>): Promise<SendPaymentLinkResult> {
  const { tenantId, user } = await getTenantContext();
  const parsed = sendSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const input = parsed.data;

  let clientId = input.clientId;
  let amount = input.amount;
  let description = input.description || undefined;
  if (input.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, tenantId },
      select: { clientId: true, status: true, startTime: true, service: { select: { name: true, price: true } } },
    });
    if (!appointment) return { success: false, error: "Appuntamento non trovato." };
    if (appointment.status === "CANCELLED") return { success: false, error: "L'appuntamento è annullato." };
    if (clientId && clientId !== appointment.clientId) return { success: false, error: "Appuntamento non trovato." };
    clientId = appointment.clientId;
    amount ??= appointment.service.price.toNumber();
    description ??= `${appointment.service.name} del ${dayFormatter.format(appointment.startTime)}`;
  }
  if (!clientId) return { success: false, error: "Scegli la cliente." };
  if (amount === undefined) return { success: false, error: "Scrivi l'importo." };
  if (!(amount >= 1)) return { success: false, error: "L'importo minimo è 1 €" };
  if (!description) return { success: false, error: "Scrivi per cosa paga" };

  const result = await ensureLink(tenantId, user.id, {
    clientId,
    appointmentId: input.appointmentId,
    amountCents: Math.round(amount * 100),
    description,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidateLinks(clientId);

  const { link } = result;
  const url = `${await getBaseUrl()}/paga/${link.token}`;
  const delivery = await deliverOnWhatsapp(tenantId, link, url);
  const base = { success: true as const, url, token: link.token, amountCents: link.amountCents, reused: result.reused };
  if (delivery.ok) return { ...base, sent: true };
  return { ...base, sent: false, fallbackUrl: whatsappUrl(link.client.phone, paymentMessage(link, url)) };
}

export async function cancelPaymentLink(token: string): Promise<{ success: true } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();
  const link = await prisma.paymentLink.findFirst({ where: { token, tenantId, status: "PENDING" }, select: { id: true, clientId: true, stripeSessionId: true } });
  if (!link) return { success: false, error: "Il link non è più da pagare." };
  const cancelled = await cancelLink(tenantId, link);
  if (!cancelled) return { success: false, error: "La cliente ha appena pagato questo link: la conferma arriva tra pochi secondi." };
  revalidateLinks(link.clientId);
  return { success: true };
}

/** Nome del template WhatsApp (servizio) per mandare il link: {{1}} nome, {{2}} per cosa, {{3}} importo, {{4}} link. */
const PAYMENT_LINK_TEMPLATE = "link_pagamento";

function paymentMessage(link: LinkWithClient, url: string) {
  return (
    `Ciao ${link.client.firstName}, ecco il link per pagare ${link.description} (${euro.format(link.amountCents / 100)}). ` +
    `Puoi pagare con carta o anche in 3 rate (se disponibile): ${url}`
  );
}

async function deliverOnWhatsapp(tenantId: string, link: LinkWithClient, url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await hasActiveWhatsapp(tenantId))) return { ok: false, error: "WhatsApp del centro non collegato: usa “Apri WhatsApp”." };

  const templates = await listTemplates(tenantId);
  if (!templates.ok) return { ok: false, error: templates.error };
  const template = templates.templates.find((t) => t.name === PAYMENT_LINK_TEMPLATE && t.status === "APPROVED");
  if (!template) return { ok: false, error: "Il template “link_pagamento” non è ancora approvato da Meta: usa “Apri WhatsApp”." };

  const result = await sendWhatsappTemplate(tenantId, {
    phone: link.client.phone,
    clientId: link.client.id,
    templateName: template.name,
    language: template.language,
    templateBody: template.body,
    params: [link.client.firstName || "-", link.description, euro.format(link.amountCents / 100), url],
    // Per minuto: blocca il doppio tocco, ma si può rimandare se la cliente lo richiede.
    dedupeKey: `payment-link:${link.id}:${Math.floor(Date.now() / 60_000)}`,
  });
  if (!result.ok) return { ok: false, error: result.error === "Messaggio già inviato." ? "Link appena inviato su WhatsApp." : result.error };
  return { ok: true };
}

/** Manda (o rimanda) il link alla cliente dal numero WhatsApp del centro (template approvato "link_pagamento"). */
export async function sendPaymentLinkWhatsapp(token: string): Promise<{ success: true } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();
  const link = await prisma.paymentLink.findFirst({ where: { token, tenantId }, select: { ...linkSelect, status: true } });
  if (!link) return { success: false, error: "Link non trovato." };
  if (link.status !== "PENDING") return { success: false, error: "Il link non è più da pagare." };
  const result = await deliverOnWhatsapp(tenantId, link, `${await getBaseUrl()}/paga/${link.token}`);
  return result.ok ? { success: true } : { success: false, error: result.error };
}
