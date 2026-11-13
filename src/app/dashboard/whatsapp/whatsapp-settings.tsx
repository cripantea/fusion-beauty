"use client";

import { BookUser, CheckCircle2, ExternalLink, MessageCircle, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, Unplug, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TemplateDialog, type TemplateDraft } from "@/components/whatsapp/template-dialog";
import type { FusionWaNumberStatus, FusionWaSyncState, FusionWaTemplate } from "@/lib/fusion-wa";
import { cn } from "@/lib/utils";
import { TEMPLATE_STATUS } from "@/lib/whatsapp-templates";

import { disconnectWhatsapp, fetchTemplates, removeTemplate, syncAppContacts } from "./actions";
import { FusionWaSignupWidget } from "./signup-widget";

export type WhatsappTab = "numero" | "template" | "rubrica";

const TABS: { value: WhatsappTab; label: string; icon: typeof MessageCircle }[] = [
  { value: "numero", label: "Numero", icon: MessageCircle },
  { value: "template", label: "Template", icon: Sparkles },
  { value: "rubrica", label: "Rubrica WhatsApp", icon: BookUser },
];

const BILLING_LABELS: Record<string, string> = {
  PAYMENT_FAILED: "Pagamento del numero non riuscito su Fusion WA: i messaggi non partono finché non si risolve.",
  PENDING: "Pagamento del numero in attesa su Fusion WA.",
  CANCELED: "Abbonamento del numero annullato su Fusion WA.",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function WhatsappSettings({
  configured,
  tab,
  tenantId,
  fusionWaBaseUrl,
  connection,
  meta,
  widgetToken,
  stateError,
  imported,
}: {
  configured: boolean;
  tab: WhatsappTab;
  tenantId: string;
  fusionWaBaseUrl: string;
  connection: { phoneNumber: string; connectedAt: string; operational: boolean | null; billingStatus: string | null } | null;
  meta: { number: FusionWaNumberStatus; sync: FusionWaSyncState | null; windowOpen: boolean } | null;
  widgetToken: string | null;
  stateError: string | null;
  imported: number;
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
    if (connection && tab === "template") loadTemplates();
  }, [connection, tab, loadTemplates]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Impostazioni"
        title="WhatsApp"
        description="Il numero del centro, i messaggi approvati da Meta e la rubrica dell'app WhatsApp Business."
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/automations" />}>
              <Zap className="size-4" />
              Automazioni
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/campaigns" />}>
              <MessageCircle className="size-4" />
              Campagne
            </Button>
          </>
        }
      />

      <nav className="flex flex-wrap gap-1 rounded-xl border border-mint-border bg-card p-1">
        {TABS.map((item) => (
          <Link
            key={item.value}
            href={`/dashboard/whatsapp${item.value === "numero" ? "" : `?tab=${item.value}`}`}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === item.value ? "bg-mint-soft text-mint-ink" : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "numero" ? (
        <>
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
            <Panel title="Stato su Meta" icon={ShieldCheck}>
              <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Invio messaggi</dt>
                  <dd className="mt-1">
                    {connection.operational === false ? <Pill tone="wine">Fermo</Pill> : connection.operational ? <Pill tone="mint">Attivo</Pill> : <Pill tone="slate">Non verificato</Pill>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Numero su Meta</dt>
                  <dd className="mt-1">{meta?.number.status ? <Pill tone={meta.number.status === "CONNECTED" ? "mint" : "amber"}>{meta.number.status === "CONNECTED" ? "Registrato" : meta.number.status}</Pill> : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">App WhatsApp Business</dt>
                  <dd className="mt-1">{meta ? (meta.number.isOnBizApp ? "In uso anche sul telefono" : "Solo da Fusion Beauty") : "—"}</dd>
                </div>
                {connection.billingStatus && BILLING_LABELS[connection.billingStatus] ? (
                  <p className="text-destructive sm:col-span-3">{BILLING_LABELS[connection.billingStatus]}</p>
                ) : null}
                <p className="text-xs text-muted-foreground sm:col-span-3">Collegato il {formatDate(connection.connectedAt)}.</p>
              </dl>
            </Panel>
          ) : null}
        </>
      ) : null}

      {tab === "template" ? (
        connection ? (
          <Panel
            title="Template approvati da Meta"
            icon={Sparkles}
            action={
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={loadTemplates} disabled={isPending}>
                  <RefreshCw className="size-3.5" />
                  Aggiorna
                </Button>
                <Button size="sm" onClick={() => setDraft({ name: "", category: "UTILITY", bodyText: "", bodyExamples: [], footerText: "" })}>
                  <Plus className="size-3.5" />
                  Nuovo template
                </Button>
              </div>
            }
          >
            <p className="px-5 pt-4 text-sm text-muted-foreground">
              Per scrivere per primi a una cliente WhatsApp richiede un messaggio approvato (template). “Servizio” per conferme e
              promemoria, “Marketing” per auguri e promozioni. La revisione di Meta di solito richiede da pochi minuti a qualche ora.
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
                        <Pill tone={TEMPLATE_STATUS[template.status]?.tone ?? "slate"}>{TEMPLATE_STATUS[template.status]?.label ?? template.status}</Pill>
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
        ) : (
          <Panel>
            <EmptyState>Collega prima il numero nella scheda “Numero”.</EmptyState>
          </Panel>
        )
      ) : null}

      {tab === "rubrica" ? (
        <Panel title="Rubrica dell'app WhatsApp Business" icon={BookUser}>
          <div className="space-y-4 p-5 text-sm">
            <p className="text-muted-foreground">
              Se il numero era già nell&apos;app WhatsApp Business, i contatti salvati nel telefono arrivano in Fusion Beauty come
              clienti (nome e numero). Chi è già in scheda non viene toccato, e l&apos;import non fa partire automazioni né vale come
              consenso marketing. Anche dopo, ogni contatto che aggiungi nell&apos;app arriva qui da solo.
            </p>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-mint-border bg-mint-soft/40 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-bold">{imported}</div>
                <div className="text-muted-foreground">clienti arrivate dalla rubrica</div>
              </div>
              <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/clients" />}>
                Vai alle clienti
                <ExternalLink className="size-3.5" />
              </Button>
            </div>
            {!connection ? (
              <p className="text-muted-foreground">Collega prima il numero nella scheda “Numero”.</p>
            ) : meta?.sync ? (
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  Rubrica richiesta a Meta: {meta.sync.contacts.requestedAt ? formatDate(meta.sync.contacts.requestedAt) : "non ancora"}
                  {meta.sync.contacts.error ? <span className="text-destructive"> — {meta.sync.contacts.error}</span> : null}
                </li>
                <li>
                  {meta.windowOpen
                    ? `Si può richiedere di nuovo fino al ${formatDate(meta.sync.windowClosesAt)}.`
                    : "Meta permette l'import solo nelle 24 ore dopo il collegamento: per rifarlo bisogna ricollegare il numero."}
                </li>
              </ul>
            ) : (
              <p className="text-muted-foreground">
                {meta && !meta.number.isOnBizApp
                  ? "Il numero non usa l'app WhatsApp Business: non c'è una rubrica da importare."
                  : "Stato della sincronizzazione non disponibile al momento."}
              </p>
            )}
            {connection && meta?.windowOpen ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await syncAppContacts();
                    if (!result.success) toast.error(result.error);
                    else {
                      toast.success("Richiesta inviata a Meta: i contatti arrivano nei prossimi minuti.");
                      router.refresh();
                    }
                  })
                }
              >
                <RefreshCw className="size-3.5" />
                Importa di nuovo la rubrica
              </Button>
            ) : null}
            {connection && meta?.windowOpen ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await syncAppContacts("history");
                    if (!result.success) toast.error(result.error);
                    else toast.success("Richiesta inviata a Meta: le vecchie chat arrivano in Messaggi nei prossimi minuti.");
                  })
                }
              >
                <RefreshCw className="size-3.5" />
                Importa lo storico delle chat
              </Button>
            ) : null}
          </div>
        </Panel>
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
              Automazioni e campagne smettono di partire e non ricevi più le risposte in Messaggi. Il numero resta tuo e continua
              a funzionare nell&apos;app WhatsApp Business. Potrai ricollegarlo quando vuoi. Per cambiare numero: scollega, poi
              collega il nuovo. Se il nuovo numero è su un altro account Meta, i messaggi pronti (template) vanno rimandati in
              approvazione.
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
