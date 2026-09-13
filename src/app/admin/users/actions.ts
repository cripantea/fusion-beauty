"use server";

import bcrypt from "bcryptjs";

import { requireSuperAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import {
  createUserSchema,
  updateUserSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from "./schema";

export type UserDTO = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR";
  isActive: boolean;
  tenantId: string | null;
  tenantName: string | null;
  createdAt: Date;
};

export type TenantOption = {
  id: string;
  name: string;
};

function toUserDTO(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR";
  isActive: boolean;
  tenantId: string | null;
  createdAt: Date;
  tenant: { name: string } | null;
}): UserDTO {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    tenantId: user.tenantId,
    tenantName: user.tenant?.name ?? null,
    createdAt: user.createdAt,
  };
}

export async function getUsers(): Promise<UserDTO[]> {
  await requireSuperAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { name: true } } },
  });

  return users.map(toUserDTO);
}

export async function getTenantOptions(): Promise<TenantOption[]> {
  await requireSuperAdmin();

  return prisma.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type UserActionResult =
  | { success: true; user: UserDTO }
  | { success: false; error: string };

export async function createUser(values: CreateUserFormValues): Promise<UserActionResult> {
  await requireSuperAdmin();

  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingEmail) {
    return { success: false, error: "Email già in uso." };
  }

  const tenantId = parsed.data.role === "SUPER_ADMIN" ? null : parsed.data.tenantId;

  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return { success: false, error: "Centro non trovato." };
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
      tenantId,
      passwordHash,
    },
    include: { tenant: { select: { name: true } } },
  });

  return { success: true, user: toUserDTO(user) };
}

export async function updateUser(
  id: string,
  values: UpdateUserFormValues
): Promise<UserActionResult> {
  const { user: currentUser } = await requireSuperAdmin();

  const parsed = updateUserSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const existingEmail = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id } },
  });
  if (existingEmail) {
    return { success: false, error: "Email già in uso da un altro utente." };
  }

  const tenantId = parsed.data.role === "SUPER_ADMIN" ? null : parsed.data.tenantId;

  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return { success: false, error: "Centro non trovato." };
    }
  }

  if (id === currentUser.id && parsed.data.role !== "SUPER_ADMIN") {
    return { success: false, error: "Non puoi rimuovere i tuoi stessi privilegi di super admin." };
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        role: parsed.data.role,
        tenantId,
        ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) } : {}),
      },
      include: { tenant: { select: { name: true } } },
    });

    return { success: true, user: toUserDTO(user) };
  } catch {
    return { success: false, error: "Utente non trovato." };
  }
}

export async function toggleUserStatus(id: string, isActive: boolean): Promise<UserActionResult> {
  const { user: currentUser } = await requireSuperAdmin();

  if (id === currentUser.id && !isActive) {
    return { success: false, error: "Non puoi disattivare il tuo stesso account." };
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      include: { tenant: { select: { name: true } } },
    });

    return { success: true, user: toUserDTO(user) };
  } catch {
    return { success: false, error: "Utente non trovato." };
  }
}
