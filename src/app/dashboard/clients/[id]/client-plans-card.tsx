"use client";

import { Check, ChevronDown, ChevronUp, Link2, Plus, Trash2, Undo2, Wallet } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, Pill } from "@/components/boutique";
import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PaymentLinkDialog, parseEuroInput, type PaymentLinkTarget } from "@/app/dashboard/payment-links/payment-link-dialog";

import {
  getClientPlans,
  createClientPlan,
  completeSession,
  uncompleteSession,
  addPlanPayment,
  removePlanPayment,
  updatePlanStatus,
  type ClientPlanDTO,
  type PlanPaymentMethod,
} from "./plan-actions";

type PlanClient = { id: string; firstName: string; phone: string };

const METHOD_LABEL: Record<PlanPaymentMethod, string> = {
  CASH: "Contanti",
  CARD: "Carta / POS",
  TRANSFER: "Bonifico",
  OTHER: "Altro",
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const statusMeta: Record<
  ClientPlanDTO["status"],
  { label: string; tone: "mint" | "forest" | "wine" | "amber" | "slate" }
> = {
  ACTIVE: { label: "In corso", tone: "mint" },
  COMPLETED: { label: "Completato", tone: "forest" },
  CANCELLED: { label: "Annullato", tone: "wine" },
};

// ── New plan dialog ───────────────────────────────────────────────────────────

function NewPlanDialog({
  clientId,
  open,
  onOpenChange,
  onCreated,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (plan: ClientPlanDTO) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState("10");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const parsedSessions = parseInt(sessions, 10);
  const parsedPrice = parseEuroInput(price);
  const pricePerSession =
    Number.isFinite(parsedPrice) && Number.isFinite(parsedSessions) && parsedSessions > 0
      ? parsedPrice / parsedSessions
      : null;

  function handleCreate() {
    if (!name.trim() || !Number.isFinite(parsedSessions) || parsedSessions < 1) return;
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error("Inserisci un prezzo valido.");
      return;
    }
    startTransition(async () => {
      const result = await createClientPlan(clientId, {
        name: name.trim(),
        totalSessions: parsedSessions,
        totalPrice: parsedPrice,
        notes: notes.trim() || undefined,
      });
      if (!result.success || !result.plan) {
        toast.error(result.error ?? "Errore nella creazione.");
        return;
      }
      onCreated(result.plan);
      onOpenChange(false);
      setName(""); setSessions("10"); setPrice(""); setNotes("");
      toast.success("Percorso creato.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo percorso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Nome percorso *</Label>
            <Input
              id="plan-name"
              placeholder="Es. Percorso Luce Flash – 10 sedute"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-sessions">Sedute totali *</Label>
              <Input
                id="plan-sessions"
                type="number"
                min={1}
                max={200}
                value={sessions}
                onChange={(e) => setSessions(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Prezzo totale (€) *</Label>
              <Input
                id="plan-price"
                inputMode="decimal"
                placeholder="Es. 800"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          {pricePerSession !== null && (
            <p className="text-xs text-muted-foreground -mt-1">
              {formatEuro(pricePerSession)} per seduta
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="plan-notes">Note (facoltative)</Label>
            <Textarea
              id="plan-notes"
              rows={2}
              placeholder="Protocollo, indicazioni, accordi..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button
            onClick={handleCreate}
            disabled={isPending || !name.trim() || parsedSessions < 1 || !Number.isFinite(parsedPrice)}
          >
            {isPending ? "Creazione..." : "Crea percorso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Payment dialog ────────────────────────────────────────────────────────────

const toInput = (value: number) => value.toFixed(2).replace(".", ",").replace(",00", "");

/** Rata o saldo: un tocco sull'importo proposto, il metodo, e via. Finisce anche in Cassa. */
function PlanPaymentDialog({
  plan,
  open,
  onOpenChange,
  onSaved,
}: {
  plan: ClientPlanDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (plan: ClientPlanDTO) => void;
}) {
  const remaining = Math.max(0, plan.totalPrice - plan.paidAmount);
  const perSession = plan.totalSessions > 0 ? plan.totalPrice / plan.totalSessions : 0;
  const [amount, setAmount] = useState(toInput(remaining));
  const [method, setMethod] = useState<PlanPaymentMethod>("CASH");
  const [isPending, startTransition] = useTransition();
  const value = parseEuroInput(amount);
  const tooMuch = value > remaining + 0.005;

  const quick = [
    { label: "Saldo", value: remaining },
    ...(perSession > 0 && perSession < remaining - 0.005 ? [{ label: "1 seduta", value: perSession }] : []),
    ...(remaining / 3 >= 1 && plan.paidAmount === 0 ? [{ label: "1/3", value: Math.round((remaining / 3) * 100) / 100 }] : []),
  ];

  function save() {
    if (!(value > 0) || tooMuch) return;
    startTransition(async () => {
      const result = await addPlanPayment(plan.id, value, method);
      if (!result.success || !result.plan) {
        toast.error(result.error ?? "Pagamento non registrato.");
        return;
      }
      onSaved(result.plan);
      onOpenChange(false);
      toast.success(`${formatEuro(value)} registrati.`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registra pagamento</DialogTitle>
          <DialogDescription>
            {plan.name} · resta {formatEuro(remaining)} su {formatEuro(plan.totalPrice)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setAmount(toInput(q.value))}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  Math.abs(value - q.value) < 0.005 ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {q.label} · {formatEuro(q.value)}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-pay-amount">Importo (€)</Label>
            <Input
              id="plan-pay-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
            {tooMuch ? <p className="text-xs text-destructive">È più del rimanente ({formatEuro(remaining)}).</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Come ha pagato</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "CARD", "TRANSFER"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                    method === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={save} disabled={isPending || !(value > 0) || tooMuch}>
            {isPending ? "Registrazione..." : `Registra ${Number.isFinite(value) && value > 0 ? formatEuro(value) : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Single plan card ──────────────────────────────────────────────────────────

function PlanCard({
  plan,
  client,
  onlinePayments,
  paymentsEnabled,
  onUpdated,
}: {
  plan: ClientPlanDTO;
  client: PlanClient;
  onlinePayments: boolean;
  /** Cassa attiva: si possono registrare incassi a mano (contanti, POS, bonifico). */
  paymentsEnabled: boolean;
  onUpdated: (plan: ClientPlanDTO) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<PaymentLinkTarget | null>(null);
  const [isPending, startTransition] = useTransition();

  const completed = plan.sessions.filter((s) => s.completedAt !== null).length;
  const progressPct = plan.totalSessions > 0 ? (completed / plan.totalSessions) * 100 : 0;
  const meta = statusMeta[plan.status];
  const remaining = plan.totalPrice - plan.paidAmount;
  const canPay = plan.status === "ACTIVE" && remaining > 0.005;
  // Pagato prima che i pagamenti finissero in Cassa: si mostra come una riga sola.
  const earlier = plan.paidAmount - plan.payments.reduce((sum, p) => sum + p.amount, 0);

  function handleToggleSession(sessionId: string, isDone: boolean) {
    startTransition(async () => {
      const result = isDone
        ? await uncompleteSession(sessionId)
        : await completeSession(sessionId);

      if (!result.success) { toast.error(result.error); return; }

      // Refresh plan from server
      const plans = await getClientPlans(plan.clientId ?? "");
      const updated = plans.find((p) => p.id === plan.id);
      if (updated) onUpdated(updated);
    });
  }

  function handleRemovePayment(paymentId: string) {
    startTransition(async () => {
      const result = await removePlanPayment(paymentId);
      if (!result.success || !result.plan) { toast.error(result.error ?? "Non è stato possibile toglierlo."); return; }
      onUpdated(result.plan);
      toast.success("Pagamento tolto.");
    });
  }

  function handleStatusChange(status: ClientPlanDTO["status"]) {
    startTransition(async () => {
      const result = await updatePlanStatus(plan.id, status);
      if (!result.success) { toast.error(result.error); return; }
      onUpdated({ ...plan, status });
    });
  }

  return (
    <div className={cn("rounded-xl border bg-card", plan.status === "CANCELLED" && "opacity-60")}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold truncate">{plan.name}</span>
            <Pill tone={meta.tone}>{meta.label}</Pill>
          </div>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 rounded-full bg-muted h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-muted-foreground shrink-0">
              {completed}/{plan.totalSessions}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{formatEuro(plan.paidAmount)}</span>
              {" pagati su "}{formatEuro(plan.totalPrice)}
            </span>
            {remaining > 0.005 && plan.status === "ACTIVE" && (
              <span className="text-amber-700 font-medium">
                {formatEuro(remaining)} ancora da incassare
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </button>

      {/* Pagamento: sempre a portata, senza aprire il percorso */}
      {canPay && (paymentsEnabled || onlinePayments) && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {paymentsEnabled && (
            <Button size="sm" className="h-8 gap-1.5" onClick={() => setPayOpen(true)}>
              <Wallet className="size-3.5" />
              Registra pagamento
            </Button>
          )}
          {onlinePayments && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() =>
                setLinkTarget({
                  clientId: client.id,
                  clientFirstName: client.firstName,
                  clientPhone: client.phone,
                  planId: plan.id,
                  amount: Math.round(remaining * 100) / 100,
                  // "Percorso laser…" resta com'è, "Laser 6 sedute" diventa "Percorso Laser 6 sedute".
                  description: /^percorso\b/i.test(plan.name) ? plan.name : `Percorso ${plan.name}`,
                })
              }
            >
              <Link2 className="size-3.5" />
              Link di pagamento
            </Button>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/60 px-4 py-3 space-y-4">
          {/* Notes */}
          {plan.notes && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              {plan.notes}
            </p>
          )}

          {/* Session list */}
          <div className="space-y-1">
            {plan.sessions.map((session) => {
              const isDone = session.completedAt !== null;
              return (
                <button
                  key={session.id}
                  type="button"
                  disabled={isPending || plan.status !== "ACTIVE"}
                  onClick={() => handleToggleSession(session.id, isDone)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    plan.status === "ACTIVE" && "hover:bg-muted/50",
                    isDone ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background"
                    )}
                  >
                    {isDone ? <Check className="size-3" strokeWidth={2.5} /> : session.sessionNumber}
                  </span>
                  <span className="flex-1 text-left">
                    Seduta {session.sessionNumber}
                    {session.notes ? <span className="ml-1 opacity-60">— {session.notes}</span> : null}
                  </span>
                  {isDone && session.completedAt && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {dateFormatter.format(new Date(session.completedAt))}
                    </span>
                  )}
                  {isDone && plan.status === "ACTIVE" && (
                    <Undo2 className="size-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Pagamenti */}
          {(plan.payments.length > 0 || earlier > 0.005) && (
            <div className="space-y-1 border-t border-border/60 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">Pagamenti</p>
              {plan.payments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{dateFormatter.format(new Date(payment.paidAt))}</span>
                  <span className="flex-1 text-muted-foreground">{payment.online ? "Online (link)" : METHOD_LABEL[payment.method]}</span>
                  <span className="font-semibold">{formatEuro(payment.amount)}</span>
                  {payment.online ? (
                    <span className="size-6 shrink-0" />
                  ) : (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Togli pagamento"
                      title="Registrato per errore? Toglilo"
                      disabled={isPending}
                      onClick={() => handleRemovePayment(payment.id)}
                      className="size-6 text-muted-foreground/60 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {earlier > 0.005 && (
                <div className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">—</span>
                  <span className="flex-1 text-muted-foreground">Registrati in precedenza</span>
                  <span className="font-semibold">{formatEuro(earlier)}</span>
                  <span className="size-6 shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {plan.status === "ACTIVE" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => handleStatusChange("COMPLETED")}
                  disabled={isPending}
                >
                  Segna completato
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-destructive/70 hover:text-destructive"
                  onClick={() => handleStatusChange("CANCELLED")}
                  disabled={isPending}
                >
                  Annulla percorso
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {canPay && paymentsEnabled && (
        <PlanPaymentDialog key={`${plan.id}-${plan.paidAmount}`} plan={plan} open={payOpen} onOpenChange={setPayOpen} onSaved={onUpdated} />
      )}
      <PaymentLinkDialog target={linkTarget} onClose={() => setLinkTarget(null)} />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ClientPlansCard({
  client,
  onlinePayments,
  paymentsEnabled,
}: {
  client: PlanClient;
  onlinePayments: boolean;
  paymentsEnabled: boolean;
}) {
  const clientId = client.id;
  const [plans, setPlans] = useState<ClientPlanDTO[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setPlans(await getClientPlans(clientId));
    });
  }, [clientId]);

  function handleUpdated(updated: ClientPlanDTO) {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleCreated(plan: ClientPlanDTO) {
    setPlans((prev) => [plan, ...prev]);
  }

  const active = plans.filter((p) => p.status === "ACTIVE");
  const past = plans.filter((p) => p.status !== "ACTIVE");

  return (
    <>
      <Panel
        title="Percorsi trattamenti"
        className="md:col-span-2"
        action={
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setNewOpen(true)}>
            <Plus className="size-3.5" />
            Nuovo percorso
          </Button>
        }
      >
        <div className="p-4 space-y-2">
          {plans.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nessun percorso avviato. Crea il primo con il bottone in alto.
            </p>
          )}
          {active.map((plan) => (
            <PlanCard key={plan.id} plan={plan} client={client} onlinePayments={onlinePayments} paymentsEnabled={paymentsEnabled} onUpdated={handleUpdated} />
          ))}
          {past.length > 0 && (
            <>
              {active.length > 0 && <div className="border-t border-border/40 my-3" />}
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 pb-1">
                Chiusi
              </p>
              {past.map((plan) => (
                <PlanCard key={plan.id} plan={plan} client={client} onlinePayments={onlinePayments} paymentsEnabled={paymentsEnabled} onUpdated={handleUpdated} />
              ))}
            </>
          )}
        </div>
      </Panel>

      <NewPlanDialog
        clientId={clientId}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={handleCreated}
      />
    </>
  );
}
