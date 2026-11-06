"use client";

import { CheckCircle2, Clock, MessageCircle, Plus, RefreshCw, Sparkles, Trash2, Unplug, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { WhatsappAutomationKind } from "@/generated/prisma/browser";
import type { FusionWaTemplate } from "@/lib/fusion-wa";
import { AUTOMATION_INFO, TEMPLATE_VARIABLES } from "@/lib/whatsapp-shared";

import { disconnectWhatsapp, fetchTemplates, removeTemplate, saveAutomation, submitTemplate } from "./actions";
import { FusionWaSignupWidget } from "./signup-widget";

export type AutomationDTO = {
  kind: WhatsappAutomationKind;
  enabled: boolean;
  templateName: string;
  language: string;
  templateBody: string;
  params: string[];
};

type TemplateDraft = { name: string; category: "UTILITY" | "MARKETING"; bodyText: string; bodyExamples: string[]; footerText: string };

const EXAMPLE_VALUES: Record<string, string> = {
  nome: "Giulia",
  cognome: "Rossi",
  centro: "Centro Estetico",
  trattamento: "Pulizia viso",
  data: "martedì 12 novembre",
  ora: "15:30",
  operatrice: "Sara",
  prenota: "https://beauty.fusionsoft.it/embed/centro",
  link: "https://beauty.fusionsoft.it/q/abc",
};

/** "Ciao {{nome}}…" → testo Meta con {{1}}, {{2}}… più i valori di esempio e i parametri da salvare. */
function toMetaTemplate(text: string) {
  const params: string[] = [];
  const body = text.replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (_, key: string) => {
    params.push(`{{${key.toLowerCase()}}}`);
    return `{{${params.length}}}`;
  });
  const examples = params.map((p) => EXAMPLE_VALUES[p.slice(2, -2)] ?? "esempio");
  return { body, params, examples };
}

const CATEGORY_FOR: Record<WhatsappAutomationKind, "UTILITY" | "MARKETING"> = {
  BOOKING_REQUEST: "UTILITY",
  BOOKING_CONFIRMED: "UTILITY",
  REMINDER: "UTILITY",
  BIRTHDAY: "MARKETING",
  FORM_WELCOME: "MARKETING",
  QUESTIONNAIRE: "UTILITY",
};

const statusTone: Record<string, "mint" | "amber" | "wine" | "slate"> = { APPROVED: "mint", PENDING: "amber", REJECTED: "wine" };
const statusLabel: Record<string, string> = { APPROVED: "Approvato", PENDING: "In revisione Meta", REJECTED: "Rifiutato", PAUSED: "In pausa", DISABLED: "Disattivato" };

export function WhatsappSettings({
  configured,
  tenantId,
  fusionWaBaseUrl,
  connection,
  widgetToken,
  stateError,
  automations,
}: {
  configured: boolean;
  tenantId: string;
  fusionWaBaseUrl: string;
  connection: { phoneNumber: string; operational: boolean | null } | null;
  widgetToken: string | null;
  stateError: string | null;
  automations: AutomationDTO[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<FusionWaTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const loadTemplates = useCallback(() => {
    startTransition(async () => {
      const result = await fetchTemplates();
      if (result.success) {
        setTemplates(result.templates);
        setTemplatesError(null);
      } else {
        setTemplatesError(result.error);
      }
    });
  }, []);

  useEffect(() => {
    if (connection) loadTemplates();
  }, [connection, loadTemplates]);

  if (!configured) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Impostazioni" title="WhatsApp" />
        <Panel>
          <EmptyState>
            WhatsApp non è ancora attivo su questo server: mancano le chiavi Fusion WA. Contatta l&apos;assistenza Fusionsoft.
          </EmptyState>
        </Panel>
      </div>
    );
  }

  const approved = (templates ?? []).filter((t) => t.status === "APPROVED");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Impostazioni"
        title="WhatsApp"
        description="Collega il numero del centro: conferme, promemoria e auguri partono da soli, e le risposte arrivano in Messaggi."
      />

      <Panel title="Numero collegato" icon={MessageCircle}>
        <div className="space-y-4 p-5">
          {connection ? (
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="size-5 text-mint-ink" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{connection.phoneNumber}</div>
                <div className="text-sm text-muted-foreground">
                  {connection.operational === false
                    ? "Il numero risulta sospeso o non attivo su Fusion WA: i messaggi non partono."
                    : "Attivo. Puoi continuare a usare l'app WhatsApp Business sul telefono."}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setConfirmDisconnect(true)}>
                <Unplug className="size-3.5" />
                Scollega
              </Button>
            </div>
          ) : widgetToken ? (
            <>
              <p className="text-sm text-muted-foreground">
                Accedi con Facebook e scegli il numero WhatsApp Business del centro. Se lo usi già nell&apos;app WhatsApp Business,
                continua a funzionare anche lì (le chat restano sincronizzate).
              </p>
              <FusionWaSignupWidget tenantId={tenantId} token={widgetToken} baseUrl={fusionWaBaseUrl} />
            </>
          ) : (
            <p className="text-sm text-destructive">{stateError ?? "Collegamento non disponibile al momento. Riprova più tardi."}</p>
          )}
        </div>
      </Panel>

      {connection ? (
        <>
          <Panel title="Messaggi automatici" icon={Zap}>
            <div className="divide-y divide-mint-border/70">
              {automations.map((automation) => (
                <AutomationRow
                  key={automation.kind}
                  automation={automation}
                  templates={approved}
                  templatesLoaded={templates !== null}
                  onCreateTemplate={(text) => {
                    const meta = toMetaTemplate(text);
                    setDraft({
                      name: automation.kind.toLowerCase(),
                      category: CATEGORY_FOR[automation.kind],
                      bodyText: meta.body,
                      bodyExamples: meta.examples,
                      footerText: "",
                    });
                  }}
                  onSaved={() => router.refresh()}
                />
              ))}
            </div>
          </Panel>

          <Panel
            title="Template approvati da Meta"
            icon={Sparkles}
            action={
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={loadTemplates} disabled={isPending}>
                  <RefreshCw className="size-3.5" />
                  Aggiorna
                </Button>
                <Button
                  size="sm"
                  onClick={() => setDraft({ name: "", category: "UTILITY", bodyText: "", bodyExamples: [], footerText: "" })}
                >
                  <Plus className="size-3.5" />
                  Nuovo template
                </Button>
              </div>
            }
          >
            <p className="px-5 pt-4 text-sm text-muted-foreground">
              Per scrivere per primi a una cliente WhatsApp richiede un messaggio approvato (template). La revisione di Meta di
              solito richiede da pochi minuti a qualche ora.
            </p>
            {templatesError ? <p className="px-5 py-4 text-sm text-destructive">{templatesError}</p> : null}
            {templates === null && !templatesError ? <EmptyState>Caricamento…</EmptyState> : null}
            {templates && templates.length === 0 ? <EmptyState>Nessun template ancora.</EmptyState> : null}
            {templates && templates.length > 0 ? (
              <ul className="divide-y divide-mint-border/70">
                {templates.map((template) => (
                  <li key={`${template.name}-${template.language}`} className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{template.name}</span>
                        <Pill tone={statusTone[template.status] ?? "slate"}>{statusLabel[template.status] ?? template.status}</Pill>
                        <span className="text-xs text-muted-foreground">
                          {template.category === "MARKETING" ? "Marketing" : "Servizio"} · {template.language}
                        </span>
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{template.body}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Elimina template"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await removeTemplate(template.name, template.externalId);
                          if (!result.success) toast.error(result.error);
                          else {
                            toast.success("Template eliminato.");
                            loadTemplates();
                          }
                        })
                      }
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        </>
      ) : null}

      <TemplateDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onCreated={() => {
          setDraft(null);
          loadTemplates();
        }}
      />

      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scollegare WhatsApp?</DialogTitle>
            <DialogDescription>
              Conferme, promemoria e auguri smettono di partire e non ricevi più le risposte in Messaggi. Il numero resta tuo e continua
              a funzionare nell&apos;app WhatsApp Business. Potrai ricollegarlo quando vuoi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDisconnect(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await disconnectWhatsapp();
                  setConfirmDisconnect(false);
                  if (!result.success) toast.error(result.error);
                  else {
                    toast.success("WhatsApp scollegato.");
                    router.refresh();
                  }
                })
              }
            >
              Scollega
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AutomationRow({
  automation,
  templates,
  templatesLoaded,
  onCreateTemplate,
  onSaved,
}: {
  automation: AutomationDTO;
  templates: FusionWaTemplate[];
  templatesLoaded: boolean;
  onCreateTemplate: (text: string) => void;
  onSaved: () => void;
}) {
  const info = AUTOMATION_INFO[automation.kind];
  const [state, setState] = useState(automation);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selected = templates.find((t) => t.name === state.templateName && t.language === state.language);
  const variableCount = selected?.variableCount ?? state.params.length;
  // Il template scelto non è (più) tra quelli approvati.
  const missing = templatesLoaded && state.templateName !== "" && !selected;

  function patch(next: Partial<AutomationDTO>) {
    setState((current) => ({ ...current, ...next }));
    setDirty(true);
  }

  function chooseTemplate(value: string) {
    const template = templates.find((t) => `${t.name}|${t.language}` === value);
    if (!template) {
      patch({ templateName: "", templateBody: "", params: [] });
      return;
    }
    // Se il template è stato creato da qui, le variabili sono già nell'ordine del testo suggerito.
    const suggested = toMetaTemplate(info.example);
    const params = Array.from({ length: template.variableCount }, (_, i) =>
      template.body === suggested.body ? suggested.params[i] ?? "" : state.params[i] ?? ""
    );
    patch({ templateName: template.name, language: template.language, templateBody: template.body, params });
  }

  function save(next = state) {
    startTransition(async () => {
      const result = await saveAutomation(next);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success(next.enabled ? "Messaggio automatico attivo." : "Impostazioni salvate.");
      onSaved();
    });
  }

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-semibold">
            {info.title}
            {automation.kind === "REMINDER" || automation.kind === "BIRTHDAY" ? <Clock className="size-3.5 text-muted-foreground" /> : null}
          </div>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={state.enabled}
            disabled={isPending || (!state.enabled && !state.templateName)}
            onCheckedChange={(enabled) => {
              const next = { ...state, enabled };
              setState(next);
              save(next);
            }}
          />
          {state.enabled ? "Attivo" : "Spento"}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Template da inviare</Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
            value={state.templateName ? `${state.templateName}|${state.language}` : ""}
            onChange={(e) => chooseTemplate(e.target.value)}
          >
            <option value="">{templates.length ? "Scegli un template approvato…" : "Nessun template approvato"}</option>
            {missing ? <option value={`${state.templateName}|${state.language}`}>{state.templateName} (non più approvato)</option> : null}
            {templates.map((t) => (
              <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                {t.name} ({t.language})
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => onCreateTemplate(info.example)}>
          <Sparkles className="size-3.5" />
          Crea con testo suggerito
        </Button>
      </div>

      {state.templateBody ? (
        <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">{state.templateBody}</p>
      ) : null}

      {variableCount > 0 && state.templateName ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Cosa mettere al posto delle variabili. Puoi usare:{" "}
            {TEMPLATE_VARIABLES.map((v) => (
              <code key={v.key} title={v.label} className="mr-1 rounded bg-muted px-1">{`{{${v.key}}}`}</code>
            ))}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: variableCount }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{`{{${i + 1}}}`}</span>
                <Input
                  value={state.params[i] ?? ""}
                  onChange={(e) => {
                    const params = [...state.params];
                    params[i] = e.target.value;
                    patch({ params });
                  }}
                  placeholder="es. {{nome}}"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {dirty ? (
        <Button size="sm" onClick={() => save()} disabled={isPending}>
          Salva
        </Button>
      ) : null}
    </div>
  );
}

function TemplateDialog({ draft, onClose, onCreated }: { draft: TemplateDraft | null; onClose: () => void; onCreated: () => void }) {
  const [state, setState] = useState<TemplateDraft | null>(draft);
  const [isPending, startTransition] = useTransition();
  const [lastDraft, setLastDraft] = useState(draft);

  // Nuova bozza dall'esterno: riparte da quella (pattern "stato derivato dalle props").
  if (draft !== lastDraft) {
    setLastDraft(draft);
    setState(draft);
  }

  const variables = Array.from(new Set(state?.bodyText.match(/\{\{(\d+)\}\}/g) ?? []));

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo template WhatsApp</DialogTitle>
          <DialogDescription>Viene inviato a Meta per l&apos;approvazione. Le variabili si scrivono {"{{1}}"}, {"{{2}}"}…</DialogDescription>
        </DialogHeader>
        {state ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Nome (solo minuscole e _)</Label>
                <Input
                  value={state.name}
                  onChange={(e) => setState({ ...state, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  placeholder="promemoria_appuntamento"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Tipo</Label>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  value={state.category}
                  onChange={(e) => setState({ ...state, category: e.target.value as TemplateDraft["category"] })}
                >
                  <option value="UTILITY">Servizio (conferme, promemoria)</option>
                  <option value="MARKETING">Marketing (auguri, promozioni)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Testo</Label>
              <Textarea rows={5} value={state.bodyText} onChange={(e) => setState({ ...state, bodyText: e.target.value })} />
            </div>
            {variables.length > 0 ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Esempi per Meta (servono per l&apos;approvazione)</Label>
                {variables.map((variable, i) => (
                  <div key={variable} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{variable}</span>
                    <Input
                      value={state.bodyExamples[i] ?? ""}
                      onChange={(e) => {
                        const bodyExamples = [...state.bodyExamples];
                        bodyExamples[i] = e.target.value;
                        setState({ ...state, bodyExamples });
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Piè di pagina (facoltativo)</Label>
              <Input value={state.footerText} onChange={(e) => setState({ ...state, footerText: e.target.value })} maxLength={60} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await submitTemplate({
                      name: state.name,
                      category: state.category,
                      bodyText: state.bodyText,
                      bodyExamples: state.bodyExamples.slice(0, variables.length),
                      footerText: state.footerText || undefined,
                    });
                    if (!result.success) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Template inviato a Meta: lo trovi “In revisione”.");
                    onCreated();
                  })
                }
              >
                Invia a Meta
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
