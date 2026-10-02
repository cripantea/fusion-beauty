"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsentCollectDialog } from "@/app/dashboard/consents/consent-collect-dialog";
import type {
  ClientConsentsDTO,
  ConsentStateValue,
} from "@/app/dashboard/consents/collect-actions";
import { consentTypeLabels } from "@/app/dashboard/consents/schema";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const stateLabels: Record<ConsentStateValue, string> = {
  SIGNED: "Firmato",
  MISSING: "Mancante",
  OUTDATED: "Da rifirmare",
  REVOKED: "Revocato",
  DECLINED: "Rifiutato",
};

const stateVariants: Record<ConsentStateValue, "default" | "secondary" | "destructive" | "outline"> = {
  SIGNED: "default",
  MISSING: "destructive",
  OUTDATED: "secondary",
  REVOKED: "destructive",
  DECLINED: "outline",
};

type ClientConsentsCardProps = {
  clientId: string;
  clientName: string;
  consents: ClientConsentsDTO;
};

export function ClientConsentsCard({ clientId, clientName, consents }: ClientConsentsCardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | undefined>();

  function openDialog(initialTemplateId?: string) {
    setTemplateId(initialTemplateId);
    setDialogOpen(true);
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Consensi</CardTitle>
          <CardDescription>Privacy, marketing e consensi informati firmati dalla cliente.</CardDescription>
        </div>
        <Button onClick={() => openDialog()}>Raccogli consenso</Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {consents.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun modello di consenso attivo.</p>
        ) : (
          <ul className="divide-y">
            {consents.items.map((item) => (
              <li key={item.templateId} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-muted-foreground">
                    {consentTypeLabels[item.type]}
                    {item.serviceName ? ` · ${item.serviceName}` : ""}
                    {item.signedAt
                      ? ` · ${dateFormatter.format(item.signedAt)} (v${item.signedVersion})`
                      : ""}
                    {item.state === "OUTDATED" ? ` · versione attuale v${item.currentVersion}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={stateVariants[item.state]}>{stateLabels[item.state]}</Badge>
                  {item.state !== "SIGNED" && item.state !== "DECLINED" ? (
                    <Button variant="outline" size="sm" onClick={() => openDialog(item.templateId)}>
                      Firma
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {consents.history.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Storico firme</h3>
            <ul className="divide-y text-sm">
              {consents.history.map((record) => (
                <li key={record.id} className="flex items-center justify-between gap-4 py-2">
                  <span>
                    {record.title} <span className="text-muted-foreground">v{record.templateVersion}</span>
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span>
                      {record.signedAt ? dateFormatter.format(record.signedAt) : "-"}
                      {record.status === "SIGNED" && !record.granted ? " · rifiutato" : ""}
                      {record.status === "REVOKED" ? " · revocato" : ""}
                    </span>
                    {record.hasPdf ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={
                            <a
                              href={`/api/consents/${record.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<a href={`/api/consents/${record.id}/pdf?download=1`} />}
                        >
                          Scarica
                        </Button>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>

      <ConsentCollectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        clientName={clientName}
        initialTemplateId={templateId}
        onCollected={() => router.refresh()}
      />
    </Card>
  );
}
