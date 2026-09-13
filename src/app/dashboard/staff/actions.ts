"use server";

import bcrypt from "bcryptjs";

import { requireTenantAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import {
  createStaffSchema,
  updateStaffSchema,
  type CreateStaffFormValues,
  type UpdateStaffFormValues,
} from "./schema";

export type StaffDTO = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "OPERATOR";
  isActive: boolean;
  createdAt: Date;
};

function toStaffDTO(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR";
  isActive: boolean;
  createdAt: Date;
}): StaffDTO {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as "ADMIN" | "OPERATOR",
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function getStaff(): Promise<StaffDTO[]> {
  const { tenantId } = await requireTenantAdmin();

  const users = await prisma.user.findMany({
    where: { tenantId, role: { in: ["ADMIN", "OPERATOR"] } },
    orderBy: { createdAt: "desc" },
  });

  return users.map(toStaffDTO);
}

export type StaffActionResult =
  | { success: true; staff: StaffDTO }
  | { success: false; error: string };

export async function createStaffMember(
  values: CreateStaffFormValues
): Promise<StaffActionResult> {
  const { tenantId } = await requireTenantAdmin();

  const parsed = createStaffSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingEmail) {
    return { success: false, error: "Email già in uso." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
      passwordHash,
    },
  });

  return { success: true, staff: toStaffDTO(user) };
}

export async function updateStaffMember(
  id: string,
  values: UpdateStaffFormValues
): Promise<StaffActionResult> {
  const { user: currentUser, tenantId } = await requireTenantAdmin();

  const parsed = updateStaffSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.tenantId !== tenantId) {
    return { success: false, error: "Utente non trovato." };
  }

  const existingEmail = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id } },
  });
  if (existingEmail) {
    return { success: false, error: "Email già in uso da un altro utente." };
  }

  if (id === currentUser.id && parsed.data.role !== "ADMIN") {
    return { success: false, error: "Non puoi rimuovere i tuoi stessi privilegi di amministratore." };
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
      ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) } : {}),
    },
  });

  return { success: true, staff: toStaffDTO(user) };
}

export async function toggleStaffStatus(id: string, isActive: boolean): Promise<StaffActionResult> {
  const { user: currentUser, tenantId } = await requireTenantAdmin();

  if (id === currentUser.id && !isActive) {
    return { success: false, error: "Non puoi disattivare il tuo stesso account." };
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.tenantId !== tenantId) {
    return { success: false, error: "Utente non trovato." };
  }

  const user = await prisma.user.update({ where: { id }, data: { isActive } });

  return { success: true, staff: toStaffDTO(user) };
}
