import { notFound } from "next/navigation";

import { requireTenantAdmin } from "@/lib/auth-context";
import { campaignStats } from "@/lib/campaign-runner";
import { parseStoredAudience, SEGMENT_LABELS } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";

import { CampaignReport } from "./campaign-report";

export default async function CampaignPage({ params }: PageProps<"/dashboard/campaigns/[id]">) {
  const { tenantId } = await requireTenantAdmin();
  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!campaign) notFound();

  const [stats, recipients] = await Promise.all([
    campaignStats(id),
    prisma.campaignRecipient.findMany({
      where: { campaignId: id },
      include: { client: { select: { id: true, firstName: true, lastName: true } }, message: { select: { status: true } } },
      orderBy: [{ sentAt: "desc" }, { id: "asc" }],
      take: 300,
    }),
  ]);
  const audience = parseStoredAudience(campaign.audience);

  return (
    <CampaignReport
      campaign={{
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        templateName: campaign.templateName,
        templateBody: campaign.templateBody,
        params: campaign.params,
        audience: SEGMENT_LABELS[audience.segment].title + (audience.marketingConsentOnly ? " · con consenso marketing" : ""),
        scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
        startedAt: campaign.startedAt?.toISOString() ?? null,
        completedAt: campaign.completedAt?.toISOString() ?? null,
        nextBatchAt: campaign.nextBatchAt?.toISOString() ?? null,
        batch: `${campaign.batchSize} ogni ${campaign.batchIntervalMinutes} min`,
      }}
      stats={stats}
      recipients={recipients.map((r) => ({
        id: r.id,
        client: { id: r.client.id, name: `${r.client.firstName} ${r.client.lastName}`.trim() },
        status: r.status,
        messageStatus: r.message?.status ?? null,
        error: r.error,
        sentAt: r.sentAt?.toISOString() ?? null,
      }))}
    />
  );
}
