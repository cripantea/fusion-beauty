"use server";

import { revalidatePath } from "next/cache";

import { getTenantContext } from "@/lib/auth-context";
import { expireCheckoutSession } from "@/lib/stripe-tenant";
import { prisma } from "@/lib/prisma";

export type ClientPlanSessionDTO = {
  id: string;
  sessionNumber: number;
  completedAt: string | null;
  notes: string | null;
};

export type PlanPaymentMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER";

export type PlanPaymentDTO = {
  id: string;
  amount: number;
  method: PlanPaymentMethod;
  paidAt: string;
  /** Pagato con il link (Stripe): si rimborsa da Stripe, non si cancella da qui. */
  online: boolean;
};

export type ClientPlanDTO = {
  id: string;
  clientId: string;
  name: string;
  totalSessions: number;
  totalPrice: number;
  paidAmount: number;
  notes: string | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  sessions: ClientPlanSessionDTO[];
  payments: PlanPaymentDTO[];
  createdAt: string;
};

const ONLINE_NOTE = "Pagato online con Stripe";

function toSessionDTO(s: {
  id: string;
  sessionNumber: number;
  completedAt: Date | null;
  notes: string | null;
}): ClientPlanSessionDTO {
  return {
    id: s.id,
    sessionNumber: s.sessionNumber,
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    notes: s.notes,
  };
}

const planInclude = {
  sessions: { orderBy: { sessionNumber: "asc" as const } },
  payments: {
    orderBy: { paidAt: "desc" as const },
    select: { id: true, amount: true, method: true, paidAt: true, notes: true },
  },
} as const;

function toPlanDTO(plan: {
  id: string;
  clientId: string;
  name: string;
  totalSessions: number;
  totalPrice: { toNumber(): number };
  paidAmount: { toNumber(): number };
  notes: string | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  sessions: { id: string; sessionNumber: number; completedAt: Date | null; notes: string | null }[];
  payments: { id: string; amount: { toNumber(): number }; method: PlanPaymentMethod; paidAt: Date; notes: string | null }[];
  createdAt: Date;
}): ClientPlanDTO {
  return {
    id: plan.id,
    clientId: plan.clientId,
    name: plan.name,
    totalSessions: plan.totalSessions,
    totalPrice: plan.totalPrice.toNumber(),
    paidAmount: plan.paidAmount.toNumber(),
    notes: plan.notes,
    status: plan.status,
    sessions: plan.sessions.map(toSessionDTO),
    payments: plan.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toNumber(),
      method: p.method,
      paidAt: p.paidAt.toISOString(),
      online: p.notes?.startsWith(ONLINE_NOTE) ?? false,
    })),
    createdAt: plan.createdAt.toISOString(),
  };
}

export async function getClientPlans(clientId: string): Promise<ClientPlanDTO[]> {
  const { tenantId } = await getTenantContext();

  const plans = await prisma.clientPlan.findMany({
    where: { tenantId, clientId },
    orderBy: { createdAt: "desc" },
    include: planInclude,
  });

  return plans.map(toPlanDTO);
}

export async function createClientPlan(
  clientId: string,
  data: {
    name: string;
    totalSessions: number;
    totalPrice: number;
    notes?: string;
  }
): Promise<{ success: boolean; plan?: ClientPlanDTO; error?: string }> {
  const { tenantId } = await getTenantContext();

  if (!data.name.trim()) return { success: false, error: "Il nome è obbligatorio." };
  if (data.totalSessions < 1 || data.totalSessions > 200)
    return { success: false, error: "Numero di sedute non valido." };
  if (data.totalPrice < 0) return { success: false, error: "Prezzo non valido." };

  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId } });
  if (!client) return { success: false, error: "Cliente non trovata." };

  try {
    const plan = await prisma.clientPlan.create({
      data: {
        tenantId,
        clientId,
        name: data.name.trim(),
        totalSessions: data.totalSessions,
        totalPrice: data.totalPrice,
        notes: data.notes?.trim() || null,
        sessions: {
          create: Array.from({ length: data.totalSessions }, (_, i) => ({
            sessionNumber: i + 1,
          })),
        },
      },
      include: planInclude,
    });

    return { success: true, plan: toPlanDTO(plan) };
  } catch {
    return { success: false, error: "Errore nella creazione del percorso." };
  }
}

export async function completeSession(
  sessionId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await getTenantContext();

  const session = await prisma.clientPlanSession.findFirst({
    where: { id: sessionId, plan: { tenantId } },
  });
  if (!session) return { success: false, error: "Seduta non trovata." };

  await prisma.clientPlanSession.update({
    where: { id: sessionId },
    data: { completedAt: new Date(), notes: notes?.trim() || null },
  });

  return { success: true };
}

export async function uncompleteSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await getTenantContext();

  const session = await prisma.clientPlanSession.findFirst({
    where: { id: sessionId, plan: { tenantId } },
  });
  if (!session) return { success: false, error: "Seduta non trovata." };

  await prisma.clientPlanSession.update({
    where: { id: sessionId },
    data: { completedAt: null },
  });

  return { success: true };
}

const METHODS: PlanPaymentMethod[] = ["CASH", "CARD", "TRANSFER", "OTHER"];

/**
 * Rata o saldo di un percorso pagato al centro (contanti, carta, bonifico):
 * si somma al pagato. Vale anche senza cassa: è solo il conto del percorso.
 */
export async function addPlanPayment(
  planId: string,
  amount: number,
  method: PlanPaymentMethod = "CASH"
): Promise<{ success: boolean; plan?: ClientPlanDTO; error?: string }> {
  const { tenantId, user } = await getTenantContext();

  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Importo non valido." };
  if (!METHODS.includes(method)) return { success: false, error: "Metodo non valido." };
  const cents = Math.round(amount * 100);

  const plan = await prisma.clientPlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) return { success: false, error: "Percorso non trovato." };
  if (plan.status === "CANCELLED") return { success: false, error: "Il percorso è annullato." };

  const remainingCents = Math.round(plan.totalPrice.toNumber() * 100) - Math.round(plan.paidAmount.toNumber() * 100);
  if (cents > remainingCents) {
    return {
      success: false,
      error: remainingCents > 0 ? `È più del rimanente (${(remainingCents / 100).toFixed(2).replace(".", ",")} €).` : "Il percorso è già saldato.",
    };
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        tenantId,
        clientId: plan.clientId,
        planId: plan.id,
        amount: cents / 100,
        method,
        notes: `Percorso: ${plan.name}`,
        createdById: user.id,
      },
    }),
    prisma.clientPlan.update({ where: { id: plan.id }, data: { paidAmount: { increment: cents / 100 } } }),
  ]);

  // I link di pagamento ancora aperti per questo percorso non devono più potersi pagare
  // (altrimenti la cliente pagherebbe due volte).
  const openLinks = await prisma.paymentLink.findMany({ where: { tenantId, planId: plan.id, status: "PENDING" }, select: { id: true, stripeSessionId: true } });
  for (const link of openLinks) {
    if ((await expireCheckoutSession(tenantId, link.stripeSessionId)) === "paid") continue;
    await prisma.paymentLink.updateMany({ where: { id: link.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  }

  revalidatePath("/dashboard/payments");
  return { success: true, plan: toPlanDTO(await prisma.clientPlan.findUniqueOrThrow({ where: { id: plan.id }, include: planInclude })) };
}

/** Toglie un pagamento registrato per errore (non quelli online: quelli si rimborsano da Stripe). */
export async function removePlanPayment(
  paymentId: string
): Promise<{ success: boolean; plan?: ClientPlanDTO; error?: string }> {
  const { tenantId } = await getTenantContext();

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId, planId: { not: null } },
    select: { id: true, planId: true, amount: true, notes: true },
  });
  if (!payment?.planId) return { success: false, error: "Pagamento non trovato." };
  if (payment.notes?.startsWith(ONLINE_NOTE)) {
    return { success: false, error: "È stato pagato online: per restituirlo fai il rimborso da Stripe." };
  }

  await prisma.$transaction([
    prisma.payment.delete({ where: { id: payment.id } }),
    prisma.clientPlan.update({ where: { id: payment.planId }, data: { paidAmount: { decrement: payment.amount } } }),
  ]);

  revalidatePath("/dashboard/payments");
  return { success: true, plan: toPlanDTO(await prisma.clientPlan.findUniqueOrThrow({ where: { id: payment.planId }, include: planInclude })) };
}

export async function updatePlanStatus(
  planId: string,
  status: "ACTIVE" | "COMPLETED" | "CANCELLED"
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await getTenantContext();

  const result = await prisma.clientPlan.updateMany({
    where: { id: planId, tenantId },
    data: { status },
  });
  if (result.count === 0) return { success: false, error: "Percorso non trovato." };

  return { success: true };
}
