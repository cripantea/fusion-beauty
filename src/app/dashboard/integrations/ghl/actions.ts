"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireTenantAdmin } from "@/lib/auth-context";
import { checkGhlAccess, runGhlImport } from "@/lib/ghl-import";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().trim().min(10, "Incolla il token della Private Integration.").max(500),
  locationId: z.string().trim().regex(/^[A-Za-z0-9]{10,40}$/, "L'ID del subaccount (Location ID) non sembra corretto."),
});

/** Avvia l'import: il token resta solo in memoria, l'avanzamento si vede nella pagina. */
export async function startGhlImport(values: z.input<typeof schema>): Promise<{ success: true } | { success: false; error: string }> {
  const { tenantId } = await requireTenantAdmin();
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const running = await prisma.dataImport.findFirst({ where: { tenantId, source: "GHL", status: "RUNNING", createdAt: { gt: new Date(Date.now() - 2 * 60 * 60_000) } } });
  if (running) return { success: false, error: "C'è già un import in corso." };

  const check = await checkGhlAccess(parsed.data.token, parsed.data.locationId);
  if (!check.ok) return { success: false, error: check.error };

  const job = await prisma.dataImport.create({ data: { tenantId, source: "GHL" } });
  after(() => runGhlImport(job.id, tenantId, parsed.data.token, parsed.data.locationId));
  revalidatePath("/dashboard/integrations/ghl");
  return { success: true };
}
