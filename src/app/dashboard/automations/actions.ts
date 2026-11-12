"use server";

import { revalidatePath } from "next/cache";

import type { AutomationStatus, Prisma } from "@/generated/prisma/client";
import { requireTenantAdmin } from "@/lib/auth-context";
import { AUTOMATION_PRESETS, automationInputSchema, automationProblem, EMPTY_AUTOMATION, type AutomationInput } from "@/lib/automations";
import { prisma } from "@/lib/prisma";

type Result = { success: true } | { success: false; error: string };

export async function createAutomation(presetKey?: string): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const { tenantId } = await requireTenantAdmin();
  const preset = AUTOMATION_PRESETS.find((p) => p.key === presetKey);
  const input = preset?.input ?? EMPTY_AUTOMATION;
  const automation = await prisma.automation.create({
    data: {
      tenantId,
      name: input.name,
      trigger: input.trigger,
      triggerConfig: input.triggerConfig as Prisma.InputJsonValue,
      steps: input.steps as Prisma.InputJsonValue,
      quietHours: input.quietHours,
      allowReentry: input.allowReentry,
      stopOnReply: input.stopOnReply,
      presetKey: preset?.key ?? null,
    },
  });
  revalidatePath("/dashboard/automations");
  return { success: true, id: automation.id };
}

/** Form, trattamenti e id dei passi devono appartenere al centro (i dati arrivano dal browser). */
async function foreignReference(tenantId: string, input: AutomationInput): Promise<string | null> {
  if (input.triggerConfig.formId) {
    const form = await prisma.form.findFirst({ where: { id: input.triggerConfig.formId, tenantId }, select: { id: true } });
    if (!form) return "Il form scelto non esiste più.";
  }
  if (input.triggerConfig.serviceIds?.length) {
    const count = await prisma.service.count({ where: { id: { in: input.triggerConfig.serviceIds }, tenantId } });
    if (count !== input.triggerConfig.serviceIds.length) return "Uno dei trattamenti scelti non esiste più.";
  }
  return null;
}

export async function saveAutomation(id: string, values: AutomationInput): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const parsed = automationInputSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Controlla i dati dell'automazione." };
  const foreign = await foreignReference(tenantId, parsed.data);
  if (foreign) return { success: false, error: foreign };

  const current = await prisma.automation.findFirst({ where: { id, tenantId }, select: { status: true } });
  if (!current) return { success: false, error: "Automazione non trovata." };
  // Un'automazione attiva resta valida: le modifiche che la rompono vanno corrette prima.
  if (current.status === "ACTIVE") {
    const problem = automationProblem(parsed.data);
    if (problem) return { success: false, error: `${problem} (oppure mettila in pausa per salvarla così)` };
  }

  await prisma.automation.update({
    where: { id },
    data: {
      name: parsed.data.name,
      trigger: parsed.data.trigger,
      triggerConfig: parsed.data.triggerConfig as Prisma.InputJsonValue,
      steps: parsed.data.steps as Prisma.InputJsonValue,
      quietHours: parsed.data.quietHours,
      allowReentry: parsed.data.allowReentry,
      stopOnReply: parsed.data.stopOnReply,
    },
  });
  revalidatePath("/dashboard/automations");
  revalidatePath(`/dashboard/automations/${id}`);
  return { success: true };
}

export async function setAutomationStatus(id: string, status: AutomationStatus): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const automation = await prisma.automation.findFirst({ where: { id, tenantId } });
  if (!automation) return { success: false, error: "Automazione non trovata." };

  if (status === "ACTIVE") {
    const parsed = automationInputSchema.safeParse({
      name: automation.name,
      trigger: automation.trigger,
      triggerConfig: automation.triggerConfig,
      steps: automation.steps,
      quietHours: automation.quietHours,
      allowReentry: automation.allowReentry,
      stopOnReply: automation.stopOnReply,
    });
    if (!parsed.success) return { success: false, error: "L'automazione ha dati non validi: aprila e salvala di nuovo." };
    const problem = automationProblem(parsed.data);
    if (problem) return { success: false, error: problem };
  }

  await prisma.automation.update({ where: { id }, data: { status } });
  revalidatePath("/dashboard/automations");
  revalidatePath(`/dashboard/automations/${id}`);
  return { success: true };
}

export async function deleteAutomation(id: string): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const result = await prisma.automation.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) return { success: false, error: "Automazione non trovata." };
  revalidatePath("/dashboard/automations");
  return { success: true };
}

/** Ferma una cliente dentro un'automazione (es. ha già prenotato per telefono). */
export async function stopRun(runId: string): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const result = await prisma.automationRun.updateMany({
    where: { id: runId, tenantId, status: { in: ["WAITING", "RUNNING"] } },
    data: { status: "STOPPED", resumeAt: null },
  });
  if (result.count === 0) return { success: false, error: "Non è più in corso." };
  revalidatePath("/dashboard/automations");
  return { success: true };
}
