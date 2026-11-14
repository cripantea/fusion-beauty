"use client";

import { Megaphone, Plus, Send, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { fetchTemplates } from "@/app/dashboard/whatsapp/actions";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateField, TimeField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TemplateDialog, type TemplateDraft } from "@/components/whatsapp/template-dialog";
import { TemplatePicker, type TemplateChoice } from "@/components/whatsapp/template-picker";
import type { CampaignStatus } from "@/generated/prisma/browser";
import { audienceProblem, CAMPAIGN_STATUS_LABELS, SEGMENT_LABELS, SEGMENTS, type Audience, type Segment } from "@/lib/campaigns";
import type { FusionWaTemplate } from "@/lib/fusion-wa";
import { cn } from "@/lib/utils";

import { createCampaign, previewAudience } from "./actions";

export type CampaignStats = { total: number; pending: number; sent: number; delivered: number; read: number; failed: number; replied: number };

export type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  templateName: string;
  scheduledAt: string | null;
  createdAt: string;
  stats: CampaignStats;
};

export const STATUS_TONE: Record<CampaignStatus, "mint" | "amber" | "wine" | "slate"> = {
  DRAFT: "slate",
  SCHEDULED: "amber",
  SENDING: "amber",
  PAUSED: "amber",
  COMPLETED: "mint",
  FAILED: "wine",
};

const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const VARIABLES = [
  { key: "nome", label: "Nome della cliente" },
  { key: "cognome", label: "Cognome" },
  { key: "centro", label: "Nome del centro" },
  { key: "prenota", label: "Link per prenotare online" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function CampaignsManager({
  campaigns,
  services,
  interests,
  whatsappReady,
}: {
  campaigns: CampaignRow[];
  services: { id: string; name: string }[];
  interests: string[];
  whatsappReady: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="WhatsApp"
        title="Campagne"
        description="Un messaggio a un gruppo di clienti: promozioni, novità, posti liberi. Parte a scaglioni, solo tra le 9 e le 20."
        actions={
          <Button onClick={() => setCreating(true)} disabled={!whatsappReady}>
            <Plus className="size-4" />
            Nuova campagna
          </Button>
        }
      />

      {!whatsappReady ? (
        <p className="rounded-xl border border-amber-200 bg-amber-soft px-4 py-3 text-sm text-amber-ink">
          Per inviare campagne collega prima il numero WhatsApp del centro.{" "}
          <Link href="/dashboard/whatsapp" className="font-medium underline">
            Collega WhatsApp
          </Link>
        </p>
      ) : null}

      <Panel title={`${campaigns.length} ${campaigns.length === 1 ? "campagna" : "campagne"}`} icon={Megaphone}>
        {campaigns.length === 0 ? (
          <EmptyState>Nessuna campagna inviata.</EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/70">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/campaigns/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{c.name}</span>
                      <Pill tone={STATUS_TONE[c.status]}>{CAMPAIGN_STATUS_LABELS[c.status]}</Pill>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.status === "SCHEDULED" && c.scheduledAt ? `Parte ${formatDate(c.scheduledAt)}` : `Creata ${formatDate(c.createdAt)}`} ·{" "}
                      <span className="font-mono">{c.templateName}</span>
                    </p>
                  </div>
                  <div className="flex gap-4 text-right text-sm">
                    <Stat label="Destinatarie" value={c.stats.total} />
                    <Stat label="Consegnati" value={c.stats.delivered} />
                    <Stat label="Letti" value={c.stats.read} />
                    <Stat label="Risposte" value={c.stats.replied} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {creating ? <NewCampaignDialog services={services} interests={interests} onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function NewCampaignDialog({ services, interests, onClose }: { services: { id: string; name: string }[]; interests: string[]; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<TemplateChoice>({ templateName: "", language: "it", templateBody: "", params: [] });
  const [audience, setAudience] = useState<Audience>({ segment: "ALL", excludeUpcoming: false, marketingConsentOnly: true });
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [batchSize, setBatchSize] = useState(40);
  const [batchInterval, setBatchInterval] = useState(10);
  const [templates, setTemplates] = useState<FusionWaTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [preview, setPreview] = useState<{ count: number; sample: string[]; withoutConsent: number | null } | { error: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  function reloadTemplates() {
    fetchTemplates().then((result) => {
      if (result.success) setTemplates(result.templates);
      setLoaded(true);
    });
  }

  useEffect(() => {
    let cancelled = false;
    fetchTemplates().then((result) => {
      if (cancelled) return;
      if (result.success) setTemplates(result.templates);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Conteggio delle destinatarie aggiornato a ogni modifica del pubblico.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (audienceProblem(audience)) return;
      previewAudience(audience).then((result) => {
        if (cancelled) return;
        setPreview(result.success ? result : { error: result.error });
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audience]);

  const audienceIssue = audienceProblem(audience);
  const count = preview && "count" in preview ? preview.count : null;
  const ready =
    name.trim() !== "" &&
    choice.templateName !== "" &&
    !choice.params.some((p) => !p.trim()) &&
    !audienceIssue &&
    (count ?? 0) > 0 &&
    (when === "now" || scheduledLocal !== "");

  function patchAudience(patch: Partial<Audience>) {
    setAudience((current) => ({ ...current, ...patch }));
    setConfirming(false);
  }

  function submit() {
    startTransition(async () => {
      const result = await createCampaign({
        name,
        templateName: choice.templateName,
        language: choice.language,
        templateBody: choice.templateBody,
        params: choice.params,
        audience,
        scheduledAt: when === "later" && scheduledLocal ? new Date(scheduledLocal).toISOString() : "",
        batchSize,
        batchIntervalMinutes: batchInterval,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(when === "now" ? "Campagna partita: il primo scaglione è in invio." : "Campagna programmata.");
      onClose();
      router.push(`/dashboard/campaigns/${result.id}`);
    });
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuova campagna WhatsApp</DialogTitle>
            <DialogDescription>Per scrivere a più clienti serve un template approvato da Meta (di solito di tipo Marketing).</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Nome (lo vedi solo tu)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Promo laser novembre" />
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">1. Il messaggio</h3>
              <TemplatePicker
                templates={templates}
                loaded={loaded}
                value={choice}
                onChange={(next) => {
                  setChoice(next);
                  setConfirming(false);
                }}
                variables={VARIABLES}
                onCreateTemplate={() => setDraft({ name: "", category: "MARKETING", bodyText: "Ciao {{1}}, ", bodyExamples: ["Giulia"], footerText: "" })}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">2. A chi</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {SEGMENTS.map((segment) => (
                  <button
                    key={segment}
                    type="button"
                    onClick={() => patchAudience({ segment: segment as Segment })}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left transition-colors",
                      audience.segment === segment ? "border-mint-ink bg-mint-soft" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="text-sm font-semibold">{SEGMENT_LABELS[segment].title}</div>
                    <div className="text-xs text-muted-foreground">{SEGMENT_LABELS[segment].description}</div>
                  </button>
                ))}
              </div>

              {audience.segment === "INACTIVE" || audience.segment === "NEW" ? (
                <div className="flex items-center gap-2 text-sm">
                  {audience.segment === "INACTIVE" ? "Ultima visita più di" : "Entrate negli ultimi"}
                  <Input
                    type="number"
                    min={1}
                    className="w-24"
                    value={audience.days ?? ""}
                    onChange={(e) => patchAudience({ days: e.target.value ? Number(e.target.value) : undefined })}
                  />
                  giorni {audience.segment === "INACTIVE" ? "fa" : ""}
                </div>
              ) : null}
              {audience.segment === "BIRTHDAY_MONTH" ? (
                <select className={cn(selectClass, "w-48")} value={audience.month ?? ""} onChange={(e) => patchAudience({ month: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Scegli il mese…</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : null}
              {audience.segment === "SERVICE" ? (
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {services.map((service) => {
                    const selected = audience.serviceIds?.includes(service.id) ?? false;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          const current = audience.serviceIds ?? [];
                          patchAudience({ serviceIds: selected ? current.filter((s) => s !== service.id) : [...current, service.id] });
                        }}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs",
                          selected ? "border-mint-ink bg-mint-soft font-medium" : "border-border hover:bg-muted/50"
                        )}
                      >
                        {service.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {audience.segment === "INTEREST" ? (
                <>
                  <Input
                    list="campaign-interests"
                    className="w-64"
                    value={audience.interest ?? ""}
                    onChange={(e) => patchAudience({ interest: e.target.value || undefined })}
                    placeholder="Es. Laser"
                  />
                  <datalist id="campaign-interests">
                    {interests.map((i) => (
                      <option key={i} value={i} />
                    ))}
                  </datalist>
                </>
              ) : null}

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={audience.marketingConsentOnly} onCheckedChange={(marketingConsentOnly) => patchAudience({ marketingConsentOnly })} />
                  Solo chi ha firmato il consenso marketing (consigliato per le promozioni)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={audience.excludeUpcoming} onCheckedChange={(excludeUpcoming) => patchAudience({ excludeUpcoming })} />
                  Escludi chi ha già un appuntamento fissato
                </label>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-mint-border bg-mint-soft/40 p-3 text-sm">
                <Users className="mt-0.5 size-4 shrink-0 text-mint-ink" />
                {audienceIssue ? (
                  <span className="text-muted-foreground">{audienceIssue}</span>
                ) : preview === null ? (
                  <span className="text-muted-foreground">Conteggio…</span>
                ) : "error" in preview ? (
                  <span className="text-destructive">{preview.error}</span>
                ) : (
                  <span>
                    <strong>{preview.count}</strong> {preview.count === 1 ? "cliente" : "clienti"}
                    {preview.sample.length ? ` (es. ${preview.sample.join(", ")})` : ""}.
                    {preview.withoutConsent ? (
                      <span className="block text-xs text-muted-foreground">
                        Altre {preview.withoutConsent} non hanno firmato il consenso marketing e sono escluse.
                      </span>
                    ) : null}
                  </span>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">3. Quando</h3>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={when === "now"} onChange={() => setWhen("now")} />
                  Subito
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={when === "later"} onChange={() => setWhen("later")} />
                  Programma
                </label>
                {when === "later" ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <DateField
                      className="w-56"
                      min={new Date().toLocaleDateString("en-CA")}
                      value={scheduledLocal.slice(0, 10)}
                      onChange={(day) => setScheduledLocal(`${day}T${scheduledLocal.slice(11) || "10:00"}`)}
                      aria-label="Giorno di invio"
                    />
                    <TimeField
                      className="w-32"
                      value={scheduledLocal.slice(11)}
                      onChange={(time) => setScheduledLocal(`${scheduledLocal.slice(0, 10) || new Date().toLocaleDateString("en-CA")}T${time}`)}
                      aria-label="Ora di invio"
                    />
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                A scaglioni di
                <Input type="number" min={5} max={500} className="w-20" value={batchSize} onChange={(e) => setBatchSize(Math.max(5, Math.min(500, Number(e.target.value) || 40)))} />
                messaggi ogni
                <Input type="number" min={1} max={1440} className="w-20" value={batchInterval} onChange={(e) => setBatchInterval(Math.max(1, Math.min(1440, Number(e.target.value) || 10)))} />
                minuti (un numero nuovo non dovrebbe mandarne troppi insieme).
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              {confirming ? (
                <span className="mr-auto text-sm">
                  Confermi l&apos;invio a <strong>{count}</strong> {count === 1 ? "cliente" : "clienti"}
                  {when === "later" && scheduledLocal ? ` il ${formatDate(new Date(scheduledLocal).toISOString())}` : ""}?
                </span>
              ) : null}
              <Button variant="outline" onClick={onClose}>
                Annulla
              </Button>
              {confirming ? (
                <Button onClick={submit} disabled={isPending || !ready}>
                  <Send className="size-4" />
                  {when === "now" ? "Sì, invia" : "Sì, programma"}
                </Button>
              ) : (
                <Button onClick={() => setConfirming(true)} disabled={!ready}>
                  <Send className="size-4" />
                  {when === "now" ? "Invia" : "Programma"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TemplateDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onCreated={() => {
          setDraft(null);
          reloadTemplates();
          toast.message("Quando Meta lo approva lo trovi tra i template da scegliere.");
        }}
      />
    </>
  );
}
