"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Clock,
  GitBranch,
  History,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Save,
  StickyNote,
  Tag,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { fetchTemplates } from "@/app/dashboard/whatsapp/actions";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TemplateDialog, type TemplateDraft } from "@/components/whatsapp/template-dialog";
import { TemplatePicker } from "@/components/whatsapp/template-picker";
import type { AutomationRunStatus, AutomationStatus, AutomationTrigger } from "@/generated/prisma/browser";
import {
  automationProblem,
  CONDITION_FIELDS,
  CONDITION_LABELS,
  newStep,
  STEP_LABELS,
  suggestedTextFor,
  templateCategoryFor,
  TRIGGER_INFO,
  TRIGGERS,
  variablesFor,
  type AutomationInput,
  type AutomationStep,
  type ConditionField,
  type StepType,
} from "@/lib/automations";
import type { FusionWaTemplate } from "@/lib/fusion-wa";
import { cn } from "@/lib/utils";
import { templateNameFrom, toMetaTemplate } from "@/lib/whatsapp-templates";

import { saveAutomation, setAutomationStatus, stopRun } from "../actions";

export type RunDTO = {
  id: string;
  status: AutomationRunStatus;
  createdAt: string;
  resumeAt: string | null;
  client: { id: string; name: string };
  log: { at: string; step: string; ok: boolean; message: string }[];
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const STEP_ICONS: Record<StepType, typeof MessageCircle> = {
  SEND_TEMPLATE: MessageCircle,
  SEND_TEXT: MessageCircle,
  WAIT: Clock,
  CONDITION: GitBranch,
  ADD_NOTE: StickyNote,
  ADD_INTEREST: Tag,
};

const RUN_STATUS: Record<AutomationRunStatus, { label: string; tone: "mint" | "amber" | "wine" | "slate" }> = {
  RUNNING: { label: "In corso", tone: "amber" },
  WAITING: { label: "In attesa", tone: "amber" },
  COMPLETED: { label: "Finita", tone: "mint" },
  FAILED: { label: "Errore", tone: "wine" },
  STOPPED: { label: "Fermata", tone: "slate" },
};

type BuilderContext = {
  templates: FusionWaTemplate[];
  templatesLoaded: boolean;
  trigger: AutomationTrigger;
  presetKey: string | null;
  onCreateTemplate: (stepId: string) => void;
};

const Ctx = createContext<BuilderContext | null>(null);
function useBuilder() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBuilder fuori dal costruttore");
  return ctx;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function AutomationBuilder({
  id,
  status,
  presetKey,
  initial,
  forms,
  services,
  runs,
  whatsappReady,
}: {
  id: string;
  status: AutomationStatus;
  presetKey: string | null;
  initial: AutomationInput;
  forms: { id: string; name: string }[];
  services: { id: string; name: string }[];
  runs: RunDTO[];
  whatsappReady: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AutomationInput>(initial);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<FusionWaTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const problem = automationProblem(form);

  function loadTemplates() {
    startTransition(async () => {
      const result = await fetchTemplates();
      if (result.success) setTemplates(result.templates);
      setTemplatesLoaded(true);
    });
  }

  useEffect(() => {
    if (!whatsappReady) return;
    let cancelled = false;
    fetchTemplates().then((result) => {
      if (cancelled) return;
      if (result.success) setTemplates(result.templates);
      setTemplatesLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [whatsappReady]);

  // Avviso se si esce con modifiche non salvate.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function update(patch: Partial<AutomationInput>) {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function save(then?: () => void) {
    startTransition(async () => {
      const result = await saveAutomation(id, form);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      if (then) then();
      else toast.success("Automazione salvata.");
      router.refresh();
    });
  }

  function changeStatus(next: AutomationStatus) {
    const run = () =>
      startTransition(async () => {
        const result = await setAutomationStatus(id, next);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(next === "ACTIVE" ? "Automazione attiva: parte da sola da adesso." : "Automazione in pausa.");
        router.refresh();
      });
    if (dirty) save(run);
    else run();
  }

  const config = form.triggerConfig;
  const usesHours = form.trigger === "BEFORE_APPOINTMENT" || form.trigger === "AFTER_APPOINTMENT";

  return (
    <Ctx.Provider
      value={{
        templates,
        templatesLoaded: templatesLoaded || !whatsappReady,
        trigger: form.trigger,
        presetKey,
        onCreateTemplate: (stepId) => {
          const text = suggestedTextFor(presetKey, stepId) ?? "Ciao {{nome}}, ";
          const meta = toMetaTemplate(text);
          setDraft({
            name: templateNameFrom(stepId === "invio" ? form.name : `${form.name} ${stepId}`),
            category: templateCategoryFor(form.trigger),
            bodyText: meta.body,
            bodyExamples: meta.examples,
            footerText: "",
          });
        },
      }}
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow="Automazione"
          title={form.name || "Automazione senza nome"}
          description={TRIGGER_INFO[form.trigger].description}
          actions={
            <>
              <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/automations" />}>
                <ArrowLeft className="size-4" />
                Tutte
              </Button>
              <Button variant="outline" onClick={() => save()} disabled={isPending || !dirty}>
                <Save className="size-4" />
                {dirty ? "Salva" : "Salvata"}
              </Button>
              {status === "ACTIVE" ? (
                <Button variant="outline" onClick={() => changeStatus("PAUSED")} disabled={isPending}>
                  <Pause className="size-4" />
                  Metti in pausa
                </Button>
              ) : (
                <Button onClick={() => changeStatus("ACTIVE")} disabled={isPending || problem !== null}>
                  <Play className="size-4" />
                  {dirty ? "Salva e attiva" : "Attiva"}
                </Button>
              )}
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={status === "ACTIVE" ? "mint" : status === "PAUSED" ? "amber" : "slate"}>
            {status === "ACTIVE" ? "Attiva" : status === "PAUSED" ? "In pausa" : "Bozza"}
          </Pill>
          {problem ? <span className="text-sm text-amber-ink">Per attivarla: {problem}</span> : null}
          {!whatsappReady ? (
            <span className="text-sm text-muted-foreground">
              WhatsApp non collegato: i messaggi partiranno dopo il{" "}
              <Link href="/dashboard/whatsapp" className="underline">
                collegamento
              </Link>
              .
            </span>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Panel title="Quando parte" icon={Zap}>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Nome (lo vedi solo tu)">
                  <Input value={form.name} onChange={(e) => update({ name: e.target.value })} />
                </Field>
                <Field label="Evento">
                  <select
                    className={selectClass}
                    value={form.trigger}
                    onChange={(e) => {
                      const trigger = e.target.value as AutomationTrigger;
                      update({
                        trigger,
                        triggerConfig: {
                          hours: trigger === "BEFORE_APPOINTMENT" || trigger === "AFTER_APPOINTMENT" ? (config.hours ?? 24) : undefined,
                          days: trigger === "CLIENT_INACTIVE" ? (config.days ?? 60) : undefined,
                        },
                      });
                    }}
                  >
                    {TRIGGERS.map((t) => (
                      <option key={t} value={t}>
                        {TRIGGER_INFO[t].title}
                      </option>
                    ))}
                  </select>
                </Field>

                {usesHours ? (
                  <Field label={form.trigger === "BEFORE_APPOINTMENT" ? "Quante ore prima dell'appuntamento" : "Quante ore dopo la fine del trattamento"}>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={config.hours ?? ""}
                      onChange={(e) => update({ triggerConfig: { ...config, hours: e.target.value ? Number(e.target.value) : undefined } })}
                    />
                  </Field>
                ) : null}
                {form.trigger === "CLIENT_INACTIVE" ? (
                  <Field label="Dopo quanti giorni senza visite" hint="Parte una volta sola per ogni “assenza”, se non ha appuntamenti fissati.">
                    <Input
                      type="number"
                      min={7}
                      max={730}
                      value={config.days ?? ""}
                      onChange={(e) => update({ triggerConfig: { ...config, days: e.target.value ? Number(e.target.value) : undefined } })}
                    />
                  </Field>
                ) : null}
                {form.trigger === "FORM_SUBMITTED" ? (
                  <Field label="Quale form">
                    <select
                      className={selectClass}
                      value={config.formId ?? ""}
                      onChange={(e) => update({ triggerConfig: { ...config, formId: e.target.value || undefined } })}
                    >
                      <option value="">Tutti i form del sito</option>
                      {forms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                {form.trigger === "WHATSAPP_RECEIVED" ? (
                  <Field label="Parola chiave (facoltativa)" hint="Es. PROMO: parte solo se il messaggio contiene questa parola.">
                    <Input
                      value={config.keyword ?? ""}
                      onChange={(e) => update({ triggerConfig: { ...config, keyword: e.target.value || undefined } })}
                      placeholder="Qualsiasi messaggio"
                    />
                  </Field>
                ) : null}
                {TRIGGER_INFO[form.trigger].appointmentVars ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Solo per questi trattamenti {config.serviceIds?.length ? `(${config.serviceIds.length})` : "(tutti)"}
                    </Label>
                    <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                      {services.map((service) => {
                        const selected = config.serviceIds?.includes(service.id) ?? false;
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => {
                              const current = config.serviceIds ?? [];
                              const serviceIds = selected ? current.filter((s) => s !== service.id) : [...current, service.id];
                              update({ triggerConfig: { ...config, serviceIds: serviceIds.length ? serviceIds : undefined } });
                            }}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs transition-colors",
                              selected ? "border-mint-ink bg-mint-soft font-medium" : "border-border hover:bg-muted/50"
                            )}
                          >
                            {service.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.quietHours} onCheckedChange={(quietHours) => update({ quietHours })} />
                    Invia solo tra le 9 e le 20 (fuori orario aspetta la mattina)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.stopOnReply} onCheckedChange={(stopOnReply) => update({ stopOnReply })} />
                    Fermati se la cliente risponde su WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={!form.allowReentry} onCheckedChange={(once) => update({ allowReentry: !once })} />
                    Una volta sola per cliente
                  </label>
                </div>
              </div>
            </Panel>

            <Panel title="Cosa fa" icon={GitBranch}>
              <div className="p-5">
                <StepList steps={form.steps} onChange={(steps) => update({ steps })} />
              </div>
            </Panel>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Panel title="Ultime clienti entrate" icon={History}>
              {runs.length === 0 ? (
                <EmptyState>Ancora nessuna. Quando l&apos;automazione è attiva, qui vedi a chi è partita e cosa ha fatto.</EmptyState>
              ) : (
                <ul className="max-h-[70vh] divide-y divide-mint-border/70 overflow-y-auto">
                  {runs.map((run) => (
                    <RunRow key={run.id} run={run} />
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>

      <TemplateDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onCreated={() => {
          setDraft(null);
          loadTemplates();
          toast.message("Quando Meta lo approva (di solito in poche ore) lo trovi tra i template da scegliere.");
        }}
      />
    </Ctx.Provider>
  );
}

function RunRow({ run }: { run: RunDTO }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <li className="space-y-1.5 px-5 py-3 text-sm">
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/clients/${run.client.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
          {run.client.name}
        </Link>
        <Pill tone={RUN_STATUS[run.status].tone}>{RUN_STATUS[run.status].label}</Pill>
      </div>
      <p className="text-xs text-muted-foreground">
        Entrata {formatDateTime(run.createdAt)}
        {run.status === "WAITING" && run.resumeAt ? ` · prossimo passo ${formatDateTime(run.resumeAt)}` : ""}
      </p>
      {run.log.length ? (
        <ul className="space-y-0.5">
          {run.log.map((entry, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              {entry.ok ? <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-mint-ink" /> : <XCircle className="mt-0.5 size-3 shrink-0 text-destructive" />}
              <span>
                <span className="font-medium">{entry.step}</span> — {entry.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {run.status === "WAITING" ? (
        <button
          type="button"
          disabled={isPending}
          className="text-xs text-muted-foreground underline"
          onClick={() =>
            startTransition(async () => {
              const result = await stopRun(run.id);
              if (!result.success) toast.error(result.error);
              else router.refresh();
            })
          }
        >
          Ferma per questa cliente
        </button>
      ) : null}
    </li>
  );
}

// ── Passi ────────────────────────────────────────────────────────────────────

const ADDABLE: StepType[] = ["SEND_TEMPLATE", "WAIT", "CONDITION", "SEND_TEXT", "ADD_NOTE", "ADD_INTEREST"];

function AddStep({ onAdd, label = "Aggiungi passo" }: { onAdd: (type: StepType) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" size="sm" className="border-dashed" />}>
        <Plus className="size-3.5" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        {ADDABLE.map((type) => {
          const Icon = STEP_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-mint-ink" />
              <span>
                <span className="block text-sm font-medium">{STEP_LABELS[type].title}</span>
                <span className="block text-xs text-muted-foreground">{STEP_LABELS[type].description}</span>
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function StepList({ steps, onChange, nested = false }: { steps: AutomationStep[]; onChange: (steps: AutomationStep[]) => void; nested?: boolean }) {
  function replace(index: number, step: AutomationStep) {
    onChange(steps.map((s, i) => (i === index ? step : s)));
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {steps.length === 0 && !nested ? <p className="text-sm text-muted-foreground">Nessun passo: aggiungi il primo.</p> : null}
      {steps.map((step, index) => (
        <div key={step.id} className="space-y-2">
          <StepCard
            step={step}
            index={index}
            last={index === steps.length - 1}
            onChange={(next) => replace(index, next)}
            onMove={(delta) => move(index, delta)}
            onRemove={() => onChange(steps.filter((_, i) => i !== index))}
          />
          {index < steps.length - 1 ? <div className="ml-5 h-3 border-l-2 border-dashed border-mint-border" /> : null}
        </div>
      ))}
      <AddStep onAdd={(type) => onChange([...steps, newStep(type)])} label={nested ? "Aggiungi" : "Aggiungi passo"} />
    </div>
  );
}

function StepCard({
  step,
  index,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  step: AutomationStep;
  index: number;
  last: boolean;
  onChange: (step: AutomationStep) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const Icon = STEP_ICONS[step.type];
  return (
    <div className="rounded-xl border border-mint-border bg-card">
      <div className="flex items-center gap-2 border-b border-mint-border/70 px-3 py-2">
        <Icon className="size-4 text-mint-ink" />
        <span className="text-sm font-semibold">{STEP_LABELS[step.type].title}</span>
        <div className="ml-auto flex items-center">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Sposta su" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Sposta giù" onClick={() => onMove(1)} disabled={last}>
            <ArrowDown className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Elimina passo" onClick={onRemove}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <StepBody step={step} onChange={onChange} />
      </div>
    </div>
  );
}

function StepBody({ step, onChange }: { step: AutomationStep; onChange: (step: AutomationStep) => void }) {
  const builder = useBuilder();
  const variables = variablesFor(builder.trigger);

  switch (step.type) {
    case "SEND_TEMPLATE":
      return (
        <TemplatePicker
          templates={builder.templates}
          loaded={builder.templatesLoaded}
          value={step}
          onChange={(choice) => onChange({ ...step, ...choice })}
          variables={variables}
          suggestedText={suggestedTextFor(builder.presetKey, step.id)}
          onCreateTemplate={() => builder.onCreateTemplate(step.id)}
        />
      );
    case "SEND_TEXT":
      return (
        <div className="space-y-1.5">
          <Textarea rows={3} value={step.message} onChange={(e) => onChange({ ...step, message: e.target.value })} placeholder="Ciao {{nome}}, …" />
          <p className="text-xs text-muted-foreground">
            Arriva solo se la cliente ti ha scritto nelle ultime 24 ore (regola di WhatsApp): adatto dopo “Messaggio WhatsApp ricevuto”.
            Variabili:{" "}
            {variables.map((v) => (
              <code key={v.key} title={v.label} className="mr-1 rounded bg-muted px-1">{`{{${v.key}}}`}</code>
            ))}
          </p>
        </div>
      );
    case "WAIT":
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={365}
            className="w-24"
            value={step.amount}
            onChange={(e) => onChange({ ...step, amount: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })}
          />
          <select className={cn(selectClass, "w-36")} value={step.unit} onChange={(e) => onChange({ ...step, unit: e.target.value as typeof step.unit })}>
            <option value="minutes">minuti</option>
            <option value="hours">ore</option>
            <option value="days">giorni</option>
          </select>
        </div>
      );
    case "ADD_NOTE":
      return <Textarea rows={2} value={step.text} onChange={(e) => onChange({ ...step, text: e.target.value })} placeholder="Es. Ha ricevuto lo sconto compleanno" />;
    case "ADD_INTEREST":
      return <Input value={step.interest} onChange={(e) => onChange({ ...step, interest: e.target.value })} placeholder="Es. Laser" />;
    case "CONDITION": {
      const needsValue = step.condition.field === "VISITS_AT_LEAST" || step.condition.field === "HAS_INTEREST";
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
            <select
              className={selectClass}
              value={step.condition.field}
              onChange={(e) => onChange({ ...step, condition: { field: e.target.value as ConditionField } })}
            >
              {CONDITION_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {CONDITION_LABELS[field]}
                </option>
              ))}
            </select>
            {needsValue ? (
              <Input
                type={step.condition.field === "VISITS_AT_LEAST" ? "number" : "text"}
                value={step.condition.value ?? ""}
                onChange={(e) => onChange({ ...step, condition: { ...step.condition, value: e.target.value } })}
                placeholder={step.condition.field === "VISITS_AT_LEAST" ? "Es. 3" : "Es. Laser"}
              />
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Branch title="Sì" tone="mint" steps={step.then} onChange={(then) => onChange({ ...step, then })} />
            <Branch title="No" tone="wine" steps={step.else} onChange={(otherwise) => onChange({ ...step, else: otherwise })} />
          </div>
          <p className="text-xs text-muted-foreground">Finito il ramo, si continua con il passo dopo questo.</p>
        </div>
      );
    }
  }
}

function Branch({ title, tone, steps, onChange }: { title: string; tone: "mint" | "wine"; steps: AutomationStep[]; onChange: (steps: AutomationStep[]) => void }) {
  return (
    <div className={cn("space-y-2 rounded-xl border-l-4 bg-muted/30 p-3", tone === "mint" ? "border-mint-ink" : "border-wine")}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <StepList steps={steps} onChange={onChange} nested />
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
