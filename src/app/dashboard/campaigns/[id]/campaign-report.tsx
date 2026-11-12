"use client";

import { ArrowLeft, Pause, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import type { CampaignRecipientStatus, CampaignStatus, WhatsappMessageStatus } from "@/generated/prisma/browser";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/campaigns";
import { fillTemplateBody } from "@/lib/whatsapp-shared";

import { deleteCampaign, pauseCampaign, resumeCampaign } from "../actions";
import { STATUS_TONE, type CampaignStats } from "../campaigns-manager";

type Recipient = {
  id: string;
  client: { id: string; name: string };
  status: CampaignRecipientStatus;
  messageStatus: WhatsappMessageStatus | null;
  error: string | null;
  sentAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function recipientLabel(r: Recipient): { label: string; tone: "mint" | "amber" | "wine" | "slate" } {
  if (r.status === "PENDING") return { label: "In coda", tone: "slate" };
  if (r.status === "FAILED" || r.messageStatus === "FAILED") return { label: "Non consegnato", tone: "wine" };
  if (r.messageStatus === "READ") return { label: "Letto", tone: "mint" };
  if (r.messageStatus === "DELIVERED") return { label: "Consegnato", tone: "mint" };
  return { label: "Inviato", tone: "amber" };
}

export function CampaignReport({
  campaign,
  stats,
  recipients,
}: {
  campaign: {
    id: string;
    name: string;
    status: CampaignStatus;
    templateName: string;
    templateBody: string;
    params: string[];
    audience: string;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    nextBatchAt: string | null;
    batch: string;
  };
  stats: CampaignStats;
  recipients: Recipient[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // In invio: i numeri si aggiornano da soli.
  useEffect(() => {
    if (campaign.status !== "SENDING") return;
    const timer = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(timer);
  }, [campaign.status, router]);

  function act(action: () => Promise<{ success: true } | { success: false; error: string }>, done: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      if (after) after();
      else router.refresh();
    });
  }

  const pct = (n: number) => (stats.sent ? `${Math.round((n / stats.sent) * 100)}%` : "—");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campagna"
        title={campaign.name}
        description={`${campaign.audience} · scaglioni da ${campaign.batch}`}
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/campaigns" />}>
              <ArrowLeft className="size-4" />
              Tutte
            </Button>
            {campaign.status === "SENDING" || campaign.status === "SCHEDULED" ? (
              <Button variant="outline" disabled={isPending} onClick={() => act(() => pauseCampaign(campaign.id), "Campagna in pausa.")}>
                <Pause className="size-4" />
                Metti in pausa
              </Button>
            ) : null}
            {campaign.status === "PAUSED" ? (
              <Button disabled={isPending} onClick={() => act(() => resumeCampaign(campaign.id), "Campagna ripartita.")}>
                <Play className="size-4" />
                Riprendi
              </Button>
            ) : null}
            {campaign.status !== "SENDING" ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => act(() => deleteCampaign(campaign.id), "Campagna eliminata.", () => router.push("/dashboard/campaigns"))}
              >
                <Trash2 className="size-4 text-destructive" />
                Elimina
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Pill tone={STATUS_TONE[campaign.status]}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Pill>
        {campaign.status === "SCHEDULED" ? <span>Parte {formatDate(campaign.scheduledAt)}</span> : null}
        {campaign.status === "SENDING" && campaign.nextBatchAt ? <span>Prossimo scaglione {formatDate(campaign.nextBatchAt)}</span> : null}
        {campaign.completedAt ? <span>Finita {formatDate(campaign.completedAt)}</span> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Destinatarie" value={String(stats.total)} />
        <Tile label="Inviati" value={String(stats.sent)} sub={stats.pending ? `${stats.pending} in coda` : undefined} />
        <Tile label="Consegnati" value={String(stats.delivered)} sub={pct(stats.delivered)} />
        <Tile label="Letti" value={String(stats.read)} sub={pct(stats.read)} />
        <Tile label="Risposte" value={String(stats.replied)} sub={pct(stats.replied)} />
        <Tile label="Non consegnati" value={String(stats.failed)} />
      </div>

      <Panel title="Messaggio">
        <div className="space-y-1 p-5 text-sm">
          <div className="font-mono text-xs text-muted-foreground">{campaign.templateName}</div>
          <p className="whitespace-pre-line">{fillTemplateBody(campaign.templateBody, campaign.params) || "—"}</p>
        </div>
      </Panel>

      <Panel title="Destinatarie">
        {recipients.length === 0 ? (
          <EmptyState>{campaign.status === "SCHEDULED" ? "L'elenco si fissa alla partenza." : "Nessuna destinataria."}</EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/70">
            {recipients.map((r) => {
              const state = recipientLabel(r);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/dashboard/clients/${r.client.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {r.client.name}
                  </Link>
                  {r.error ? <span className="max-w-xs truncate text-xs text-destructive" title={r.error}>{r.error}</span> : null}
                  <span className="text-xs text-muted-foreground">{formatDate(r.sentAt)}</span>
                  <Pill tone={state.tone}>{state.label}</Pill>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-mint-border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
