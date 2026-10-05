"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export type ClientPlanSessionDTO = {
  id: string;
  sessionNumber: number;
  completedAt: string | null;
  notes: string | null;
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
  createdAt: string;
};

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

export async function addPlanPayment(
  planId: string,
  amount: number
): Promise<{ success: boolean; newPaidAmount?: number; error?: string }> {
  const { tenantId } = await getTenantContext();

  const plan = await prisma.clientPlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) return { success: false, error: "Percorso non trovato." };
  if (amount <= 0) return { success: false, error: "Importo non valido." };

  const updated = await prisma.clientPlan.update({
    where: { id: planId },
    data: { paidAmount: { increment: amount } },
    select: { paidAmount: true },
  });

  return { success: true, newPaidAmount: updated.paidAmount.toNumber() };
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
