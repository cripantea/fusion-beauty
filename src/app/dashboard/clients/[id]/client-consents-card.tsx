"use client";

import { FileCheck2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { ConsentCollectDialog } from "@/app/dashboard/consents/consent-collect-dialog";
import { revokeConsent } from "@/app/dashboard/consents/collect-actions";
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

const stateTones: Record<ConsentStateValue, "mint" | "amber" | "wine" | "slate"> = {
  SIGNED: "mint",
  MISSING: "wine",
  OUTDATED: "amber",
  REVOKED: "wine",
  DECLINED: "slate",
};

type ClientConsentsCardProps = {
  clientId: string;
  clientName: string;
  consents: ClientConsentsDTO;
};

function RevokeButton({ recordId, title }: { recordId: string; title: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    if (
      !window.confirm(
        `Revocare il consenso "${title}"? L'operazione resta registrata e potrà essere raccolto un nuovo consenso.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await revokeConsent(recordId);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Consenso revocato.");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleRevoke}>
      {isPending ? "Revoca..." : "Revoca"}
    </Button>
  );
}

export function ClientConsentsCard({ clientId, clientName, consents }: ClientConsentsCardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | undefined>();

  function openDialog(initialTemplateId?: string) {
    setTemplateId(initialTemplateId);
    setDialogOpen(true);
  }

  return (
    <Panel
      title="Consensi firmati"
      icon={FileCheck2}
      className="md:col-span-2"
      action={
        <Button size="sm" className="rounded-lg" onClick={() => openDialog()}>
          Raccogli consenso
        </Button>
      }
    >
      <div className="space-y-6 p-5">
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
                  <Pill tone={stateTones[item.state]}>
                    {item.state === "SIGNED" ? "✓ " : item.state === "OUTDATED" ? "! " : ""}
                    {stateLabels[item.state]}
                  </Pill>
                  {item.state !== "SIGNED" && item.state !== "DECLINED" ? (
                    <Button variant="outline" size="sm" onClick={() => openDialog(item.templateId)}>
                      Firma
                    </Button>
                  ) : null}
                  {item.revocable && item.recordId ? (
                    <RevokeButton recordId={item.recordId} title={item.title} />
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
                    {record.revocable ? <RevokeButton recordId={record.id} title={record.title} /> : null}
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
      </div>

      <ConsentCollectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        clientName={clientName}
        initialTemplateId={templateId}
        onCollected={() => router.refresh()}
      />
    </Panel>
  );
}
