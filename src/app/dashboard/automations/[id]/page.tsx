import { notFound } from "next/navigation";

import { requireTenantAdmin } from "@/lib/auth-context";
import { parseStoredSteps, parseStoredTriggerConfig } from "@/lib/automations";
import { isFusionWaConfigured } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";

import { AutomationBuilder, type RunDTO } from "./automation-builder";

type LogEntry = { at: string; step: string; ok: boolean; message: string };

export default async function AutomationPage({ params }: PageProps<"/dashboard/automations/[id]">) {
  const { tenantId } = await requireTenantAdmin();
  const { id } = await params;
  const automation = await prisma.automation.findFirst({ where: { id, tenantId } });
  if (!automation) notFound();

  const [forms, services, runs, connection] = await Promise.all([
    prisma.form.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.service.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.automationRun.findMany({
      where: { automationId: id },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.whatsappConnection.findUnique({ where: { tenantId }, select: { id: true } }),
  ]);

  const runDTOs: RunDTO[] = runs.map((run) => ({
    id: run.id,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    resumeAt: run.resumeAt?.toISOString() ?? null,
    client: { id: run.client.id, name: `${run.client.firstName} ${run.client.lastName}`.trim() },
    log: (Array.isArray(run.log) ? (run.log as LogEntry[]) : []).slice(-8),
  }));

  return (
    <AutomationBuilder
      id={automation.id}
      status={automation.status}
      presetKey={automation.presetKey}
      initial={{
        name: automation.name,
        trigger: automation.trigger,
        triggerConfig: parseStoredTriggerConfig(automation.triggerConfig),
        steps: parseStoredSteps(automation.steps),
        quietHours: automation.quietHours,
        allowReentry: automation.allowReentry,
        stopOnReply: automation.stopOnReply,
      }}
      forms={forms}
      services={services}
      runs={runDTOs}
      whatsappReady={isFusionWaConfigured() && connection !== null}
    />
  );
}
