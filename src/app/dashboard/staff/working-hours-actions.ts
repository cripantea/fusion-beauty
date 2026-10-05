"use server";

import { requireTenantAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export type WorkingHourDTO = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type StaffExceptionDTO = {
  id: string;
  date: string; // "YYYY-MM-DD"
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};

export async function getWorkingHours(userId: string): Promise<WorkingHourDTO[]> {
  const { tenantId } = await requireTenantAdmin();

  const rows = await prisma.workingHours.findMany({
    where: { tenantId, userId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
  }));
}

export async function setWorkingHours(
  userId: string,
  hours: { dayOfWeek: number; startTime: string; endTime: string }[]
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await requireTenantAdmin();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.workingHours.deleteMany({ where: { userId, tenantId } });
      if (hours.length > 0) {
        await tx.workingHours.createMany({
          data: hours.map((h) => ({
            tenantId,
            userId,
            dayOfWeek: h.dayOfWeek,
            startTime: h.startTime,
            endTime: h.endTime,
            isActive: true,
          })),
        });
      }
    });
    return { success: true };
  } catch {
    return { success: false, error: "Errore nel salvataggio degli orari." };
  }
}

export async function getStaffExceptions(userId: string): Promise<StaffExceptionDTO[]> {
  const { tenantId } = await requireTenantAdmin();

  const rows = await prisma.staffException.findMany({
    where: { tenantId, userId },
    orderBy: { date: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    startTime: row.startTime,
    endTime: row.endTime,
    note: row.note,
  }));
}

export async function createStaffException(
  userId: string,
  data: { date: string; startTime?: string; endTime?: string; note?: string }
): Promise<{ success: boolean; error?: string; exception?: StaffExceptionDTO }> {
  const { tenantId } = await requireTenantAdmin();

  try {
    const row = await prisma.staffException.create({
      data: {
        tenantId,
        userId,
        date: new Date(data.date),
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        note: data.note?.trim() || null,
      },
    });
    return {
      success: true,
      exception: {
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        startTime: row.startTime,
        endTime: row.endTime,
        note: row.note,
      },
    };
  } catch {
    return { success: false, error: "Errore nel salvataggio dell'imprevisto." };
  }
}

export async function deleteStaffException(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await requireTenantAdmin();

  try {
    const result = await prisma.staffException.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) return { success: false, error: "Imprevisto non trovato." };
    return { success: true };
  } catch {
    return { success: false, error: "Errore nella cancellazione." };
  }
}
