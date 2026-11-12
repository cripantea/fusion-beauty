import { requireTenantAdmin } from "@/lib/auth-context";
import { campaignStats } from "@/lib/campaign-runner";
import { isFusionWaConfigured } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";

import { CampaignsManager, type CampaignRow } from "./campaigns-manager";

export default async function CampaignsPage() {
  const { tenantId } = await requireTenantAdmin();
  const [campaigns, connection, services, interests] = await Promise.all([
    prisma.campaign.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.whatsappConnection.findUnique({ where: { tenantId }, select: { id: true } }),
    prisma.service.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.$queryRaw<{ interest: string }[]>`
      SELECT DISTINCT unnest(interests) AS interest FROM clients WHERE "tenantId" = ${tenantId} ORDER BY 1`,
  ]);

  const rows: CampaignRow[] = await Promise.all(
    campaigns.map(async (c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      templateName: c.templateName,
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      stats: await campaignStats(c.id),
    }))
  );

  return (
    <CampaignsManager
      campaigns={rows}
      services={services}
      interests={interests.map((i) => i.interest)}
      whatsappReady={isFusionWaConfigured() && connection !== null}
    />
  );
}
