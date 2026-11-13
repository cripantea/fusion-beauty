"use client";

import { Code2, Copy, ExternalLink, FileInput, Inbox, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { CopyCode } from "@/components/copy-code";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { FORM_PRESETS } from "@/lib/forms";

import { createForm, deleteForm, duplicateForm, setFormEnabled } from "./actions";

type FormRow = {
  id: string;
  name: string;
  displayMode: "INLINE" | "POPUP";
  enabled: boolean;
  submissions: number;
  lastSubmissionAt: string | null;
  embedCode: string;
  publicUrl: string;
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function FormsManager({ forms }: { forms: FormRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [embedFor, setEmbedFor] = useState<FormRow | null>(null);
  const [deleting, setDeleting] = useState<FormRow | null>(null);

  function create(presetId: string) {
    startTransition(async () => {
      const result = await createForm(presetId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.push(`/dashboard/forms/${result.id}`);
    });
  }

  function run(action: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error ?? "Operazione non riuscita.");
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sito web"
        title="Form"
        description="Moduli da mettere nel tuo sito: chi li compila entra subito tra le tue clienti."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            Nuovo form
          </Button>
        }
      />

      <Panel title="I tuoi form" icon={FileInput}>
        {forms.length === 0 ? (
          <EmptyState>
            Nessun form ancora. Creane uno, copia il codice e incollalo nel tuo sito (WordPress, Wix, Fusion Sites…).
          </EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/70">
            {forms.map((form) => (
              <li key={form.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/forms/${form.id}`} className="font-semibold hover:underline">
                    {form.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Pill tone={form.displayMode === "POPUP" ? "amber" : "slate"}>
                      {form.displayMode === "POPUP" ? "Bolla popup" : "Nella pagina"}
                    </Pill>
                    <span>
                      {form.submissions} {form.submissions === 1 ? "risposta" : "risposte"}
                      {form.lastSubmissionAt ? ` · ultima ${dateFormatter.format(new Date(form.lastSubmissionAt))}` : ""}
                    </span>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={form.enabled}
                    disabled={isPending}
                    onCheckedChange={(checked) => run(() => setFormEnabled(form.id, checked), checked ? "Form attivo." : "Form in pausa.")}
                  />
                  {form.enabled ? "Attivo" : "In pausa"}
                </label>
                <Button variant="outline" size="sm" onClick={() => setEmbedFor(form)}>
                  <Code2 className="size-3.5" />
                  Codice
                </Button>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/dashboard/forms/${form.id}/risposte`} />}>
                  <Inbox className="size-3.5" />
                  Risposte
                </Button>
                <Popover>
                  <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Altre azioni" />}>
                    <MoreHorizontal className="size-4" />
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-48 p-1">
                    <MenuButton icon={Pencil} onClick={() => router.push(`/dashboard/forms/${form.id}`)}>Modifica</MenuButton>
                    <MenuButton icon={ExternalLink} onClick={() => window.open(form.publicUrl, "_blank")}>Apri pagina del form</MenuButton>
                    <MenuButton icon={Copy} onClick={() => run(() => duplicateForm(form.id), "Form duplicato (in pausa).")}>Duplica</MenuButton>
                    <MenuButton icon={Trash2} destructive onClick={() => setDeleting(form)}>Elimina</MenuButton>
                  </PopoverContent>
                </Popover>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuovo form</DialogTitle>
            <DialogDescription>Parti da un modello: potrai cambiare campi, testi e colori.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {FORM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={isPending}
                onClick={() => create(preset.id)}
                className="rounded-xl border border-mint-border px-4 py-3 text-left transition-colors hover:bg-mint-soft/60 disabled:opacity-60"
              >
                <div className="font-semibold">{preset.name}</div>
                <div className="text-sm text-muted-foreground">{preset.description}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={embedFor !== null} onOpenChange={(open) => !open && setEmbedFor(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Metti “{embedFor?.name}” nel sito</DialogTitle>
            <DialogDescription>
              Incolla il codice nel punto della pagina dove vuoi il form (in WordPress: blocco “HTML personalizzato”).
              {embedFor?.displayMode === "POPUP" ? " In modalità bolla compare in basso a destra su tutta la pagina." : ""}
            </DialogDescription>
          </DialogHeader>
          {embedFor ? (
            <div className="space-y-4">
              <CopyCode code={embedFor.embedCode} />
              <div className="space-y-1 text-sm">
                <div className="font-medium">Oppure condividi il link diretto</div>
                <CopyCode code={embedFor.publicUrl} label="Copia link" />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminare “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              Il form smette di funzionare sui siti dove è incollato e le sue risposte vengono cancellate.
              Le clienti già create restano in archivio.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Annulla</Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                const target = deleting;
                setDeleting(null);
                if (target) run(() => deleteForm(target.id), "Form eliminato.");
              }}
            >
              Elimina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MenuButton({
  icon: Icon,
  children,
  onClick,
  destructive,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${destructive ? "text-destructive" : ""}`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
