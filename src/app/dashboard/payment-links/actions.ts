"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getBaseUrl } from "@/lib/app-url";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listTemplates } from "@/lib/fusion-wa";
import { getStripeStatus } from "@/lib/stripe-tenant";
import { hasActiveWhatsapp, sendWhatsappTemplate } from "@/lib/whatsapp";

const createSchema = z.object({
  clientId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  /** Euro, con i centesimi (es. 120.50). */
  amount: z.number().min(1, "L'importo minimo è 1 €").max(20_000, "Importo troppo alto"),
  description: z.string().trim().min(1, "Scrivi per cosa paga").max(200),
});

export type PaymentLinkResult = { success: true; url: string; token: string } | { success: false; error: string };

export async function createPaymentLink(values: z.input<typeof createSchema>): Promise<PaymentLinkResult> {
  const { tenantId, user } = await getTenantContext();
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const stripe = await getStripeStatus(tenantId);
  if (!stripe.connected) return { success: false, error: "Collega prima Stripe (Impostazioni → Pagamenti online)." };

  const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, tenantId }, select: { id: true } });
  if (!client) return { success: false, error: "Cliente non trovata." };
  if (parsed.data.appointmentId) {
    const appointment = await prisma.appointment.findFirst({ where: { id: parsed.data.appointmentId, tenantId, clientId: client.id } });
    if (!appointment) return { success: false, error: "Appuntamento non trovato." };
    // Un solo link attivo per appuntamento: il nuovo sostituisce quello vecchio non pagato.
    const paid = await prisma.paymentLink.findFirst({ where: { appointmentId: appointment.id, status: "PAID" } });
    if (paid) return { success: false, error: "Questo appuntamento è già stato pagato online." };
    await prisma.paymentLink.updateMany({ where: { appointmentId: appointment.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  }

  const token = randomBytes(18).toString("base64url");
  await prisma.paymentLink.create({
    data: {
      tenantId,
      clientId: client.id,
      appointmentId: parsed.data.appointmentId ?? null,
      amountCents: Math.round(parsed.data.amount * 100),
      description: parsed.data.description,
      token,
      createdById: user.id,
    },
  });
  revalidatePath("/dashboard/payment-links");
  revalidatePath("/dashboard/calendar");
  return { success: true, url: `${await getBaseUrl()}/paga/${token}`, token };
}

export async function cancelPaymentLink(token: string): Promise<{ success: true } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();
  const result = await prisma.paymentLink.updateMany({ where: { token, tenantId, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (result.count === 0) return { success: false, error: "Il link non è più da pagare." };
  revalidatePath("/dashboard/payment-links");
  revalidatePath("/dashboard/calendar");
  return { success: true };
}

/** Nome del template WhatsApp (servizio) per mandare il link: {{1}} nome, {{2}} per cosa, {{3}} importo, {{4}} link. */
const PAYMENT_LINK_TEMPLATE = "link_pagamento";

/** Manda il link alla cliente dal numero WhatsApp del centro (template approvato "link_pagamento"). */
export async function sendPaymentLinkWhatsapp(token: string): Promise<{ success: true } | { success: false; error: string }> {
  const { tenantId } = await getTenantContext();
  const link = await prisma.paymentLink.findFirst({ where: { token, tenantId }, include: { client: true } });
  if (!link) return { success: false, error: "Link non trovato." };
  if (link.status !== "PENDING") return { success: false, error: "Il link non è più da pagare." };
  if (!(await hasActiveWhatsapp(tenantId))) return { success: false, error: "WhatsApp del centro non collegato: usa “Apri WhatsApp”." };

  const templates = await listTemplates(tenantId);
  if (!templates.ok) return { success: false, error: templates.error };
  const template = templates.templates.find((t) => t.name === PAYMENT_LINK_TEMPLATE && t.status === "APPROVED");
  if (!template) return { success: false, error: "Il template “link_pagamento” non è ancora approvato da Meta: usa “Apri WhatsApp”." };

  const amount = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(link.amountCents / 100);
  const result = await sendWhatsappTemplate(tenantId, {
    phone: link.client.phone,
    clientId: link.client.id,
    templateName: template.name,
    language: template.language,
    templateBody: template.body,
    params: [link.client.firstName || "-", link.description, amount, `${await getBaseUrl()}/paga/${link.token}`],
    dedupeKey: `payment-link:${link.id}`,
  });
  if (!result.ok) return { success: false, error: result.error === "Messaggio già inviato." ? "Link già inviato su WhatsApp." : result.error };
  return { success: true };
}
