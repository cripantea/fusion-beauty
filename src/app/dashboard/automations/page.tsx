import { requireTenantAdmin } from "@/lib/auth-context";
import { isFusionWaConfigured } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";

import { AutomationsManager, type AutomationRow } from "./automations-manager";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

export default async function AutomationsPage() {
  const { tenantId } = await requireTenantAdmin();
  const since = daysAgo(30);

  const [automations, connection, counts, waiting] = await Promise.all([
    prisma.automation.findMany({ where: { tenantId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
    prisma.whatsappConnection.findUnique({ where: { tenantId }, select: { phoneNumber: true } }),
    prisma.automationRun.groupBy({ by: ["automationId"], where: { tenantId, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.automationRun.groupBy({ by: ["automationId"], where: { tenantId, status: "WAITING" }, _count: { _all: true } }),
  ]);

  const rows: AutomationRow[] = automations.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    trigger: a.trigger,
    runs30d: counts.find((c) => c.automationId === a.id)?._count._all ?? 0,
    waiting: waiting.find((c) => c.automationId === a.id)?._count._all ?? 0,
  }));

  return <AutomationsManager automations={rows} whatsappReady={isFusionWaConfigured() && connection !== null} />;
}
