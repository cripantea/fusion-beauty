"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { requireTenantAdmin } from "@/lib/auth-context";
import { DEFAULT_FORM, FORM_PRESETS, formInputSchema, formProblem, type FormInput } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

export type FormActionResult = { success: true; id: string } | { success: false; error: string };

export async function createForm(presetId?: string): Promise<FormActionResult> {
  const { tenantId } = await requireTenantAdmin();
  const preset = FORM_PRESETS.find((p) => p.id === presetId);
  const input: FormInput = { ...DEFAULT_FORM, ...preset?.form };

  const form = await prisma.form.create({
    data: {
      tenantId,
      name: input.name,
      title: input.title,
      fields: input.fields as Prisma.InputJsonValue,
      settings: input.settings as Prisma.InputJsonValue,
      displayMode: input.displayMode,
      color: input.color,
      welcomeMessage: input.welcomeMessage,
      enabled: input.enabled,
    },
  });
  revalidatePath("/dashboard/forms");
  return { success: true, id: form.id };
}

export async function saveForm(id: string, values: FormInput): Promise<FormActionResult> {
  const { tenantId } = await requireTenantAdmin();
  const parsed = formInputSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { success: false, error: issue?.message ?? "Controlla i dati del form." };
  }
  const problem = formProblem(parsed.data);
  if (problem) return { success: false, error: problem };

  const result = await prisma.form.updateMany({
    where: { id, tenantId },
    data: {
      name: parsed.data.name,
      title: parsed.data.title,
      fields: parsed.data.fields as Prisma.InputJsonValue,
      settings: parsed.data.settings as Prisma.InputJsonValue,
      displayMode: parsed.data.displayMode,
      color: parsed.data.color,
      welcomeMessage: parsed.data.welcomeMessage,
      enabled: parsed.data.enabled,
    },
  });
  if (result.count === 0) return { success: false, error: "Form non trovato." };
  revalidatePath("/dashboard/forms");
  return { success: true, id };
}

export async function setFormEnabled(id: string, enabled: boolean): Promise<FormActionResult> {
  const { tenantId } = await requireTenantAdmin();
  const result = await prisma.form.updateMany({ where: { id, tenantId }, data: { enabled } });
  if (result.count === 0) return { success: false, error: "Form non trovato." };
  revalidatePath("/dashboard/forms");
  return { success: true, id };
}

export async function duplicateForm(id: string): Promise<FormActionResult> {
  const { tenantId } = await requireTenantAdmin();
  const form = await prisma.form.findFirst({ where: { id, tenantId } });
  if (!form) return { success: false, error: "Form non trovato." };
  const copy = await prisma.form.create({
    data: {
      tenantId,
      name: `${form.name} (copia)`,
      title: form.title,
      fields: form.fields as Prisma.InputJsonValue,
      settings: form.settings as Prisma.InputJsonValue,
      displayMode: form.displayMode,
      color: form.color,
      welcomeMessage: form.welcomeMessage,
      enabled: false,
    },
  });
  revalidatePath("/dashboard/forms");
  return { success: true, id: copy.id };
}

/** Elimina il form e le sue risposte; le clienti create restano in archivio. */
export async function deleteForm(id: string): Promise<FormActionResult> {
  const { tenantId } = await requireTenantAdmin();
  const result = await prisma.form.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) return { success: false, error: "Form non trovato." };
  revalidatePath("/dashboard/forms");
  return { success: true, id };
}
