"use client";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/signature-pad";

import {
  collectConsent,
  getCollectableTemplates,
  type CollectableTemplateDTO,
} from "./collect-actions";
import { consentTypeLabels } from "./schema";

type ConsentCollectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  /** Presente quando si firma dal dettaglio appuntamento. */
  appointment?: { id: string; serviceId: string; serviceName: string };
  /** Modello da preselezionare (es. dal pulsante "Firma" su un consenso mancante). */
  initialTemplateId?: string;
  onCollected?: () => void;
};

export function ConsentCollectDialog(props: ConsentCollectDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-2xl">
        {/* Montato solo a dialog aperto: ogni apertura riparte da uno stato pulito. */}
        {props.open ? <ConsentCollectBody {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ConsentCollectBody({
  onOpenChange,
  clientId,
  clientName,
  appointment,
  initialTemplateId,
  onCollected,
}: ConsentCollectDialogProps) {
  const [templates, setTemplates] = useState<CollectableTemplateDTO[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [granted, setGranted] = useState(true);
  const [anamnesis, setAnamnesis] = useState("");
  const [signatureKey, setSignatureKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const appointmentId = appointment?.id;
  const serviceId = appointment?.serviceId;

  useEffect(() => {
    let cancelled = false;

    getCollectableTemplates({ clientId, serviceId, appointmentId }).then((result) => {
      if (cancelled) return;
      setTemplates(result);
      const preferred =
        result.find((template) => template.id === initialTemplateId) ??
        result.find((template) => !template.alreadySigned) ??
        result[0];
      setTemplateId(preferred?.id ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, serviceId, appointmentId, initialTemplateId]);

  const selected = templates?.find((template) => template.id === templateId) ?? null;

  function handleTemplateChange(value: string) {
    setTemplateId(value);
    setSignature(null);
    setGranted(true);
    setAnamnesis("");
    // La firma è legata al testo mostrato: cambiando modello si riparte da un canvas vuoto.
    setSignatureKey((key) => key + 1);
  }

  function handleSubmit() {
    if (!selected || !signature) return;

    startTransition(async () => {
      const result = await collectConsent({
        clientId,
        templateId: selected.id,
        appointmentId: selected.type === "TREATMENT" ? appointmentId : undefined,
        signature,
        granted: selected.type === "MARKETING" ? granted : true,
        anamnesis: selected.type === "TREATMENT" ? anamnesis : undefined,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Consenso registrato.");
      onCollected?.();
      onOpenChange(false);
    });
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>Raccogli consenso</DialogTitle>
          <DialogDescription>
            {clientName}
            {appointment ? ` — ${appointment.serviceName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {templates === null ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun modello di consenso attivo. Un amministratore può crearli in &quot;Modelli consenso&quot;.
          </p>
        ) : (
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label>Modello</Label>
              <Select value={templateId} onValueChange={(value) => handleTemplateChange(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => {
                      const template = templates.find((item) => item.id === value);
                      return template ? template.title : "";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                      {template.alreadySigned ? " (già firmato)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected ? (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {consentTypeLabels[selected.type]} · v{selected.version}
                    {selected.serviceName ? ` · ${selected.serviceName}` : ""}
                  </p>
                  <div className="max-h-56 min-w-0 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 text-sm [overflow-wrap:anywhere]">
                    {selected.body}
                  </div>
                  {selected.alreadySigned ? (
                    <p className="text-xs text-amber-600">
                      Questa versione risulta già firmata: salvando si registra un nuovo consenso.
                    </p>
                  ) : null}
                </div>

                {selected.type === "MARKETING" ? (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label className="pr-4">La cliente acconsente alle comunicazioni promozionali</Label>
                    <Switch checked={granted} onCheckedChange={(checked) => setGranted(checked)} />
                  </div>
                ) : null}

                {selected.type === "TREATMENT" ? (
                  <div className="space-y-2">
                    <Label>Anamnesi / note (facoltativo)</Label>
                    <Textarea
                      rows={3}
                      value={anamnesis}
                      maxLength={5000}
                      onChange={(event) => setAnamnesis(event.target.value)}
                      placeholder="Allergie, patologie, farmaci, gravidanza..."
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>Firma della cliente</Label>
                  <SignaturePad key={`${selected.id}-${signatureKey}`} onChange={setSignature} />
                </div>
              </>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="button" disabled={isPending || !selected || !signature} onClick={handleSubmit}>
            {isPending ? "Salvataggio..." : "Salva consenso"}
          </Button>
        </DialogFooter>
    </>
  );
}
