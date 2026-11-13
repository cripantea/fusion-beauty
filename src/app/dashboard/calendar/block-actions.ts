"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

/** Impegno dello staff (pausa, ferie, visita, corso...): l'operatrice non è prenotabile. */
export type StaffBlockDTO = {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  title: string;
  note: string | null;
};

/** Imprevisto da Staff: senza orario = assente tutto il giorno, con orario = lavora solo in quella fascia. */
export type StaffAbsenceDTO = {
  userId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};

export type StaffBlockInput = {
  userId: string;
  start: Date;
  end: Date;
  title: string;
  note?: string;
};

export type StaffBlockResult =
  | { success: true; block: StaffBlockDTO; warning?: string }
  | { success: false; error: string };

const MAX_BLOCK_DAYS = 62;

const blockSelect = { id: true, userId: true, startTime: true, endTime: true, title: true, note: true } as const;

export async function getStaffBlocks(input: { start: Date; end: Date }): Promise<StaffBlockDTO[]> {
  const { tenantId } = await getTenantContext();

  return prisma.staffBlock.findMany({
    where: { tenantId, startTime: { lt: input.end }, endTime: { gt: input.start } },
    orderBy: { startTime: "asc" },
    select: blockSelect,
  });
}

export async function getStaffAbsences(input: { start: Date; end: Date }): Promise<StaffAbsenceDTO[]> {
  const { tenantId } = await getTenantContext();

  // date è un @db.Date (mezzanotte UTC): si allarga di un giorno per non perdere i bordi.
  const rows = await prisma.staffException.findMany({
    where: {
      tenantId,
      date: { gte: new Date(input.start.getTime() - 86400000), lte: new Date(input.end.getTime() + 86400000) },
    },
    select: { userId: true, date: true, startTime: true, endTime: true, note: true },
  });

  return rows.map((row) => ({
    userId: row.userId,
    date: row.date.toISOString().slice(0, 10),
    startTime: row.startTime,
    endTime: row.endTime,
    note: row.note,
  }));
}

/** Controlli comuni: dati validi, operatrice del centro, permessi (staff solo per sé, titolare per tutte). */
async function validate(
  input: StaffBlockInput
): Promise<{ ok: true; tenantId: string; userId: string; data: StaffBlockInput } | { ok: false; error: string }> {
  const { user, tenantId } = await getTenantContext();

  const title = input.title?.trim();
  const start = new Date(input.start);
  const end = new Date(input.end);
  if (!title || title.length > 80) return { ok: false, error: "Scrivi cos'è l'impegno (massimo 80 caratteri)." };
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { ok: false, error: "Data o ora non valide." };
  if (end <= start) return { ok: false, error: "La fine deve essere dopo l'inizio." };
  if (end.getTime() - start.getTime() > MAX_BLOCK_DAYS * 86400000) {
    return { ok: false, error: `Un impegno può durare al massimo ${MAX_BLOCK_DAYS} giorni.` };
  }

  if (user.role !== "ADMIN" && input.userId !== user.id) {
    return { ok: false, error: "Puoi segnare impegni solo per te." };
  }
  const member = await prisma.user.findFirst({
    where: { id: input.userId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!member) return { ok: false, error: "Operatrice non trovata." };

  return {
    ok: true,
    tenantId,
    userId: user.id,
    data: { userId: member.id, start, end, title, note: input.note?.trim() || undefined },
  };
}

/** Avviso (non blocca): l'operatrice ha già appuntamenti in quell'orario. */
async function overlapWarning(tenantId: string, data: StaffBlockInput): Promise<string | undefined> {
  const count = await prisma.appointment.count({
    where: {
      tenantId,
      operatorId: data.userId,
      status: { in: ["BOOKED", "CONFIRMED"] },
      startTime: { lt: data.end },
      endTime: { gt: data.start },
    },
  });
  if (count === 0) return undefined;
  return count === 1
    ? "Attenzione: in quell'orario c'è già 1 appuntamento. Spostalo o avvisa la cliente."
    : `Attenzione: in quell'orario ci sono già ${count} appuntamenti. Spostali o avvisa le clienti.`;
}

export async function createStaffBlock(input: StaffBlockInput): Promise<StaffBlockResult> {
  const checked = await validate(input);
  if (!checked.ok) return { success: false, error: checked.error };
  const { tenantId, data } = checked;

  const block = await prisma.staffBlock.create({
    data: {
      tenantId,
      userId: data.userId,
      startTime: data.start,
      endTime: data.end,
      title: data.title,
      note: data.note ?? null,
      createdById: checked.userId,
    },
    select: blockSelect,
  });

  return { success: true, block, warning: await overlapWarning(tenantId, data) };
}

/** L'impegno esiste e chi lo tocca può farlo (staff solo i propri). */
async function findEditable(id: string) {
  const { user, tenantId } = await getTenantContext();
  const block = await prisma.staffBlock.findFirst({ where: { id, tenantId }, select: { id: true, userId: true } });
  if (!block) return { ok: false as const, error: "Impegno non trovato." };
  if (user.role !== "ADMIN" && block.userId !== user.id) {
    return { ok: false as const, error: "Puoi modificare solo i tuoi impegni." };
  }
  return { ok: true as const, tenantId };
}

export async function updateStaffBlock(id: string, input: StaffBlockInput): Promise<StaffBlockResult> {
  const editable = await findEditable(id);
  if (!editable.ok) return { success: false, error: editable.error };

  const checked = await validate(input);
  if (!checked.ok) return { success: false, error: checked.error };
  const { tenantId, data } = checked;

  const block = await prisma.staffBlock.update({
    where: { id },
    data: {
      userId: data.userId,
      startTime: data.start,
      endTime: data.end,
      title: data.title,
      note: data.note ?? null,
    },
    select: blockSelect,
  });

  return { success: true, block, warning: await overlapWarning(tenantId, data) };
}

export async function deleteStaffBlock(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const editable = await findEditable(id);
  if (!editable.ok) return { success: false, error: editable.error };

  await prisma.staffBlock.deleteMany({ where: { id, tenantId: editable.tenantId } });
  return { success: true };
}
