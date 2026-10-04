"use server";

import { requireTenantAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export type WorkingHourDTO = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export async function getWorkingHours(userId: string): Promise<WorkingHourDTO[]> {
  const { tenantId } = await requireTenantAdmin();

  const rows = await prisma.workingHours.findMany({
    where: { tenantId, userId },
    orderBy: { dayOfWeek: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    isActive: row.isActive,
  }));
}

export async function setWorkingHours(
  userId: string,
  hours: { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[]
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await requireTenantAdmin();

  try {
    await prisma.$transaction(
      hours.map((hour) =>
        prisma.workingHours.upsert({
          where: { userId_dayOfWeek: { userId, dayOfWeek: hour.dayOfWeek } },
          create: {
            tenantId,
            userId,
            dayOfWeek: hour.dayOfWeek,
            startTime: hour.startTime,
            endTime: hour.endTime,
            isActive: hour.isActive,
          },
          update: {
            startTime: hour.startTime,
            endTime: hour.endTime,
            isActive: hour.isActive,
          },
        })
      )
    );

    return { success: true };
  } catch {
    return { success: false, error: "Errore nel salvataggio degli orari." };
  }
}
