"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitTemplate } from "@/app/dashboard/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type TemplateDraft = { name: string; category: "UTILITY" | "MARKETING"; bodyText: string; bodyExamples: string[]; footerText: string };

/** Nuovo template da inviare a Meta (impostazioni WhatsApp, automazioni, campagne). */
export function TemplateDialog({ draft, onClose, onCreated }: { draft: TemplateDraft | null; onClose: () => void; onCreated: () => void }) {
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
