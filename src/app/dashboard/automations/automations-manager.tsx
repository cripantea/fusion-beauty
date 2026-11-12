"use client";

import { MessageCircle, Plus, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { AutomationStatus, AutomationTrigger } from "@/generated/prisma/browser";
import { AUTOMATION_PRESETS, TRIGGER_INFO } from "@/lib/automations";

import { createAutomation, deleteAutomation, setAutomationStatus } from "./actions";

export type AutomationRow = {
  id: string;
  name: string;
  status: AutomationStatus;
  trigger: AutomationTrigger;
  runs30d: number;
  waiting: number;
};

const STATUS: Record<AutomationStatus, { label: string; tone: "mint" | "amber" | "slate" }> = {
  ACTIVE: { label: "Attiva", tone: "mint" },
  PAUSED: { label: "In pausa", tone: "amber" },
  DRAFT: { label: "Bozza", tone: "slate" },
};

export function AutomationsManager({ automations, whatsappReady }: { automations: AutomationRow[]; whatsappReady: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [choosing, setChoosing] = useState(false);
  const [deleting, setDeleting] = useState<AutomationRow | null>(null);

  function create(presetKey?: string) {
    startTransition(async () => {
      const result = await createAutomation(presetKey);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.push(`/dashboard/automations/${result.id}`);
    });
  }

  function toggle(row: AutomationRow, active: boolean) {
    startTransition(async () => {
      const result = await setAutomationStatus(row.id, active ? "ACTIVE" : "PAUSED");
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(active ? `“${row.name}” è attiva.` : `“${row.name}” è in pausa.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="WhatsApp"
        title="Automazioni"
        description="Messaggi che partono da soli: promemoria, auguri, conferme, richiami. Scegli un modello pronto o costruiscila tu."
        actions={
          <Button onClick={() => setChoosing(true)} disabled={isPending}>
            <Plus className="size-4" />
            Nuova automazione
          </Button>
        }
      />

      {!whatsappReady ? (
        <p className="rounded-xl border border-amber-200 bg-amber-soft px-4 py-3 text-sm text-amber-ink">
          WhatsApp non è ancora collegato: puoi preparare le automazioni, ma i messaggi partono solo dopo il collegamento del numero.{" "}
          <Link href="/dashboard/whatsapp" className="font-medium underline">
            Collega WhatsApp
          </Link>
        </p>
      ) : null}

      <Panel title={`${automations.length} ${automations.length === 1 ? "automazione" : "automazioni"}`} icon={Zap}>
        {automations.length === 0 ? (
          <EmptyState>Nessuna automazione. Inizia da un modello: promemoria e auguri di compleanno sono i più usati.</EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/70">
            {automations.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Link href={`/dashboard/automations/${row.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold hover:underline">{row.name}</span>
                    <Pill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Pill>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {TRIGGER_INFO[row.trigger].title} · {row.runs30d} {row.runs30d === 1 ? "cliente" : "clienti"} negli ultimi 30 giorni
                    {row.waiting ? ` · ${row.waiting} in attesa` : ""}
                  </p>
                </Link>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={row.status === "ACTIVE"} disabled={isPending} onCheckedChange={(active) => toggle(row, active)} />
                  {row.status === "ACTIVE" ? "Attiva" : "Spenta"}
                </label>
                <Button variant="ghost" size="icon-sm" aria-label="Elimina automazione" onClick={() => setDeleting(row)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nuova automazione</DialogTitle>
            <DialogDescription>Parti da un modello già pronto (poi scegli il messaggio) oppure da zero.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[65vh] gap-2 overflow-y-auto sm:grid-cols-2">
            {AUTOMATION_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                disabled={isPending}
                onClick={() => create(preset.key)}
                className="rounded-xl border border-border p-3 text-left transition-colors hover:border-mint-ink hover:bg-mint-soft/50"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="size-4 text-mint-ink" />
                  {preset.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
              </button>
            ))}
            <button
              type="button"
              disabled={isPending}
              onClick={() => create()}
              className="rounded-xl border border-dashed border-border p-3 text-left transition-colors hover:border-mint-ink hover:bg-mint-soft/50"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Plus className="size-4 text-mint-ink" />
                Da zero
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Scegli tu quando parte e cosa fa, passo per passo.</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminare “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              Si ferma anche per le clienti che sono in attesa di un passo. I messaggi già inviati restano nelle chat. Se vuoi solo
              fermarla per un po&apos;, spegnila invece di eliminarla.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  if (!deleting) return;
                  const result = await deleteAutomation(deleting.id);
                  setDeleting(null);
                  if (!result.success) toast.error(result.error);
                  else {
                    toast.success("Automazione eliminata.");
                    router.refresh();
                  }
                })
              }
            >
              Elimina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
