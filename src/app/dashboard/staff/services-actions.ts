"use server";

import { z } from "zod";

import { requireTenantAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export type OperatorServicesDTO = {
  services: { id: string; name: string }[];
  excludedServiceIds: string[];
};

export async function getOperatorServices(userId: string): Promise<OperatorServicesDTO> {
  const { tenantId } = await requireTenantAdmin();

  const [services, operator] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { excludedServices: { select: { id: true } } },
    }),
  ]);

  return {
    services,
    excludedServiceIds: operator?.excludedServices.map((service) => service.id) ?? [],
  };
}

/** Salva i trattamenti che l'operatrice non esegue; tutti gli altri restano prenotabili con lei. */
export async function setOperatorExcludedServices(
  userId: string,
  excludedServiceIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await requireTenantAdmin();

  const parsed = z.array(z.string().min(1)).max(500).safeParse(excludedServiceIds);
  if (!parsed.success) {
    return { success: false, error: "Selezione non valida." };
  }

  const operator = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } });
  if (!operator) {
    return { success: false, error: "Utente non trovato." };
  }

  const services = await prisma.service.findMany({
    where: { tenantId, id: { in: parsed.data } },
    select: { id: true },
  });

  await prisma.user.update({
    where: { id: operator.id },
    data: { excludedServices: { set: services.map((service) => ({ id: service.id })) } },
  });

  return { success: true };
}
