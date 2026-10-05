"use client";

import { Check, ChevronDown, ChevronUp, Plus, Undo2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

import {
  getClientPlans,
  createClientPlan,
  completeSession,
  uncompleteSession,
  addPlanPayment,
  updatePlanStatus,
  type ClientPlanDTO,
} from "./plan-actions";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
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
  const parsedPrice = parseFloat(price.replace(",", "."));
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

// ── Single plan card ──────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onUpdated,
}: {
  plan: ClientPlanDTO;
  onUpdated: (plan: ClientPlanDTO) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [showPayInput, setShowPayInput] = useState(false);
  const [isPending, startTransition] = useTransition();

  const completed = plan.sessions.filter((s) => s.completedAt !== null).length;
  const progressPct = plan.totalSessions > 0 ? (completed / plan.totalSessions) * 100 : 0;
  const meta = statusMeta[plan.status];
  const remaining = plan.totalPrice - plan.paidAmount;

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

  function handleAddPayment() {
    const amount = parseFloat(payAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    startTransition(async () => {
      const result = await addPlanPayment(plan.id, amount);
      if (!result.success) { toast.error(result.error); return; }
      onUpdated({ ...plan, paidAmount: result.newPaidAmount ?? plan.paidAmount });
      setPayAmount("");
      setShowPayInput(false);
      toast.success("Pagamento registrato.");
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

          {/* Actions */}
          {plan.status === "ACTIVE" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              {/* Payment */}
              {showPayInput ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">€</span>
                  <Input
                    inputMode="decimal"
                    placeholder="Importo"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="h-8 w-28 text-sm"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddPayment} disabled={isPending} className="h-8">
                    Conferma
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowPayInput(false); setPayAmount(""); }} className="h-8">
                    Annulla
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => setShowPayInput(true)}
                >
                  <Plus className="size-3.5" />
                  Registra pagamento
                </Button>
              )}

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
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ClientPlansCard({ clientId }: { clientId: string }) {
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
            <PlanCard key={plan.id} plan={plan} onUpdated={handleUpdated} />
          ))}
          {past.length > 0 && (
            <>
              {active.length > 0 && <div className="border-t border-border/40 my-3" />}
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 pb-1">
                Chiusi
              </p>
              {past.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onUpdated={handleUpdated} />
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
