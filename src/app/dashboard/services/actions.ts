"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { serviceFormSchema, type ServiceFormValues } from "./schema";

export type ServiceDTO = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  isActive: boolean;
  isOnlineBookingEnabled: boolean;
};

type ServiceRecord = {
  id: string;
  name: string;
  description: string | null;
  price: { toNumber(): number };
  durationMinutes: number;
  isActive: boolean;
  isOnlineBookingEnabled: boolean;
};

function toServiceDTO(service: ServiceRecord): ServiceDTO {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price.toNumber(),
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    isOnlineBookingEnabled: service.isOnlineBookingEnabled,
  };
}

export type ServiceStatusFilter = "all" | "active" | "inactive";

export async function getServices(input?: {
  search?: string;
  status?: ServiceStatusFilter;
}): Promise<ServiceDTO[]> {
  const { tenantId } = await getTenantContext();

  const search = input?.search?.trim();
  const status = input?.status ?? "all";

  const services = await prisma.service.findMany({
    where: {
      tenantId,
      ...(status === "active" && { isActive: true }),
      ...(status === "inactive" && { isActive: false }),
      ...(search && { name: { contains: search, mode: "insensitive" as const } }),
    },
    orderBy: { name: "asc" },
  });

  return services.map(toServiceDTO);
}

export type ServiceActionResult =
  | { success: true; service: ServiceDTO }
  | { success: false; error: string };

function normalizeDescription(description: string | undefined): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

export async function createService(
  values: ServiceFormValues
): Promise<ServiceActionResult> {
  const { tenantId } = await getTenantContext();

  const parsed = serviceFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const service = await prisma.service.create({
    data: {
      tenantId,
      name: parsed.data.name,
      description: normalizeDescription(parsed.data.description),
      price: parsed.data.price,
      durationMinutes: parsed.data.durationMinutes,
      isOnlineBookingEnabled: parsed.data.isOnlineBookingEnabled,
    },
  });

  return { success: true, service: toServiceDTO(service) };
}

export async function updateService(
  id: string,
  values: ServiceFormValues
): Promise<ServiceActionResult> {
  const { tenantId } = await getTenantContext();

  const parsed = serviceFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const result = await prisma.service.updateMany({
    where: { id, tenantId },
    data: {
      name: parsed.data.name,
      description: normalizeDescription(parsed.data.description),
      price: parsed.data.price,
      durationMinutes: parsed.data.durationMinutes,
      isOnlineBookingEnabled: parsed.data.isOnlineBookingEnabled,
    },
  });

  if (result.count === 0) {
    return { success: false, error: "Trattamento non trovato." };
  }

  const service = await prisma.service.findFirstOrThrow({ where: { id, tenantId } });
  return { success: true, service: toServiceDTO(service) };
}

export async function toggleServiceStatus(
  id: string,
  isActive: boolean
): Promise<ServiceActionResult> {
  const { tenantId } = await getTenantContext();

  const result = await prisma.service.updateMany({
    where: { id, tenantId },
    data: { isActive },
  });

  if (result.count === 0) {
    return { success: false, error: "Trattamento non trovato." };
  }

  const service = await prisma.service.findFirstOrThrow({ where: { id, tenantId } });
  return { success: true, service: toServiceDTO(service) };
}
