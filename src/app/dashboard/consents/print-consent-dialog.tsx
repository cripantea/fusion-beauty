"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

import { getClientsForSelect, type ClientSelectItem } from "./collect-actions";

type PrintConsentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateTitle: string;
};

export function PrintConsentDialog({
  open,
  onOpenChange,
  templateId,
  templateTitle,
}: PrintConsentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <PrintConsentBody
            templateId={templateId}
            templateTitle={templateTitle}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PrintConsentBody({
  templateId,
  templateTitle,
  onClose,
}: {
  templateId: string;
  templateTitle: string;
  onClose: () => void;
}) {
  const [clients, setClients] = useState<ClientSelectItem[] | null>(null);
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    let cancelled = false;
    getClientsForSelect().then((result) => {
      if (!cancelled) setClients(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleOpen() {
    if (!clientId) return;
    window.open(
      `/api/consents/template/${templateId}/print?clientId=${clientId}`,
      "_blank"
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Stampa per cliente</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <p className="text-sm text-muted-foreground">{templateTitle}</p>
        <div className="space-y-2">
          <Label>Cliente</Label>
          {clients === null ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : (
            <Select value={clientId} onValueChange={(value) => setClientId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleziona una cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.lastName} {client.firstName} — {client.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Annulla
        </Button>
        <Button type="button" disabled={!clientId} onClick={handleOpen}>
          Apri PDF
        </Button>
      </DialogFooter>
    </>
  );
}
