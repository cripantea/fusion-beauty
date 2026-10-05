"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  deleteConsentTemplate,
  toggleConsentTemplateStatus,
  type ConsentTemplateDTO,
} from "./actions";
import {
  ConsentTemplateFormDialog,
  type ServiceOption,
} from "./consent-template-form-dialog";
import { PrintConsentDialog } from "./print-consent-dialog";
import { consentTypeLabels } from "./schema";

type ConsentsManagerProps = {
  initialTemplates: ConsentTemplateDTO[];
  services: ServiceOption[];
};

export function ConsentsManager({ initialTemplates, services }: ConsentsManagerProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConsentTemplateDTO | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [printTemplate, setPrintTemplate] = useState<ConsentTemplateDTO | null>(null);
  const [, startTransition] = useTransition();

  function openCreateDialog() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  function openEditDialog(template: ConsentTemplateDTO) {
    setEditingTemplate(template);
    setDialogOpen(true);
  }

  function upsertTemplate(template: ConsentTemplateDTO) {
    setTemplates((current) => {
      const exists = current.some((item) => item.id === template.id);
      return exists
        ? current.map((item) => (item.id === template.id ? template : item))
        : [template, ...current];
    });
  }

  function handleToggle(template: ConsentTemplateDTO) {
    setPendingId(template.id);
    startTransition(async () => {
      const result = await toggleConsentTemplateStatus(template.id, !template.isActive);
      setPendingId(null);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(result.template.isActive ? "Modello attivato." : "Modello disattivato.");
      upsertTemplate(result.template);
    });
  }

  function handleDelete(template: ConsentTemplateDTO) {
    if (!window.confirm(`Eliminare il modello "${template.title}"?`)) return;

    setPendingId(template.id);
    startTransition(async () => {
      const result = await deleteConsentTemplate(template.id);
      setPendingId(null);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Modello eliminato.");
      setTemplates((current) => current.filter((item) => item.id !== template.id));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Modelli di consenso</h1>
          <p className="text-muted-foreground">
            Gestisci i testi di privacy, marketing e consenso informato da far firmare ai clienti.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Nuovo modello</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelli ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Trattamento</TableHead>
                <TableHead>Versione</TableHead>
                <TableHead>Firme</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{consentTypeLabels[template.type]}</Badge>
                  </TableCell>
                  <TableCell>{template.serviceName ?? "-"}</TableCell>
                  <TableCell>v{template.version}</TableCell>
                  <TableCell>{template.signedCount}</TableCell>
                  <TableCell>
                    <Badge variant={template.isActive ? "default" : "outline"}>
                      {template.isActive ? "Attivo" : "Disattivato"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(template)}>
                      Modifica
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPrintTemplate(template)}
                    >
                      Stampa per cliente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingId === template.id}
                      onClick={() => handleToggle(template)}
                    >
                      {template.isActive ? "Disattiva" : "Attiva"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingId === template.id || template.signedCount > 0}
                      onClick={() => handleDelete(template)}
                    >
                      Elimina
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nessun modello di consenso. Creane uno per iniziare.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConsentTemplateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        services={services}
        onSuccess={upsertTemplate}
      />

      <PrintConsentDialog
        open={printTemplate !== null}
        onOpenChange={(open) => { if (!open) setPrintTemplate(null); }}
        templateId={printTemplate?.id ?? ""}
        templateTitle={printTemplate?.title ?? ""}
      />
    </div>
  );
}
