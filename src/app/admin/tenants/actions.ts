"use server";

import bcrypt from "bcryptjs";

import { requireSuperAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { createTenantSchema, type CreateTenantFormValues } from "./schema";

export type TenantDTO = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  userCount: number;
  clientCount: number;
};

function toTenantDTO(tenant: {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: { users: number; clients: number };
}): TenantDTO {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    email: tenant.email,
    phone: tenant.phone,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt,
    userCount: tenant._count.users,
    clientCount: tenant._count.clients,
  };
}

const tenantCountInclude = {
  _count: { select: { users: true, clients: true } },
} as const;

export async function getTenants(): Promise<TenantDTO[]> {
  await requireSuperAdmin();

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: tenantCountInclude,
  });

  return tenants.map(toTenantDTO);
}

export type TenantActionResult =
  | { success: true; tenant: TenantDTO }
  | { success: false; error: string };

export async function createTenant(
  values: CreateTenantFormValues
): Promise<TenantActionResult> {
  await requireSuperAdmin();

  const parsed = createTenantSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const existingSlug = await prisma.tenant.findUnique({
    where: { slug: parsed.data.tenantSlug },
  });
  if (existingSlug) {
    return { success: false, error: "Slug già in uso." };
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email: parsed.data.adminEmail },
  });
  if (existingEmail) {
    return { success: false, error: "Email amministratore già in uso." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.adminPassword, 10);

  const tenantId = await prisma.$transaction(async (tx) => {
    const createdTenant = await tx.tenant.create({
      data: {
        name: parsed.data.tenantName,
        slug: parsed.data.tenantSlug,
        isActive: true,
      },
    });

    await tx.user.create({
      data: {
        tenantId: createdTenant.id,
        email: parsed.data.adminEmail,
        passwordHash,
        firstName: parsed.data.adminFirstName,
        lastName: parsed.data.adminLastName,
        role: "ADMIN",
      },
    });

    return createdTenant.id;
  });

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    include: tenantCountInclude,
  });

  return { success: true, tenant: toTenantDTO(tenant) };
}

export async function toggleTenantStatus(
  id: string,
  isActive: boolean
): Promise<TenantActionResult> {
  await requireSuperAdmin();

  try {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: { isActive },
      include: tenantCountInclude,
    });

    return { success: true, tenant: toTenantDTO(tenant) };
  } catch {
    return { success: false, error: "Centro non trovato." };
  }
}
