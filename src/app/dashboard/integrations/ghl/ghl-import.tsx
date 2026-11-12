"use client";

import { Download, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { startGhlImport } from "./actions";

type ImportRow = { id: string; status: string; stats: Record<string, number>; error: string | null; createdAt: string; finishedAt: string | null };

const SCOPES = ["contacts.readonly", "conversations.readonly", "conversations/message.readonly"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function GhlImport({ imports }: { imports: ImportRow[] }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [isPending, startTransition] = useTransition();
  const running = imports[0]?.status === "RUNNING";

  // Import in corso: i numeri si aggiornano da soli.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [running, router]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Impostazioni"
        title="Importa da GoHighLevel"
        description="Porta in Fusion Beauty i contatti e le conversazioni (WhatsApp, SMS, chat del sito) di un subaccount GHL. Chi è già in scheda non viene toccato e si può rilanciare senza doppioni."
      />

      <Panel title="Collega il subaccount" icon={KeyRound}>
        <div className="space-y-4 p-5 text-sm">
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>Nel subaccount GHL apri Settings → Private Integrations → “Create new integration” e chiamala “Fusion Beauty”.</li>
            <li>
              Dai solo questi permessi:{" "}
              {SCOPES.map((s) => (
                <code key={s} className="mr-1 rounded bg-muted px-1">
                  {s}
                </code>
              ))}
            </li>
            <li>Copia il token e incollalo qui sotto, con il Location ID (è nell&apos;indirizzo di GHL: …/location/<b>questo</b>/…).</li>
            <li>Finito l&apos;import puoi eliminare la Private Integration da GHL: il token non viene salvato.</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Token della Private Integration</Label>
              <Input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="pit-…" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Location ID</Label>
              <Input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="kI9e0a0coDz2kJ8AL4mb" className="font-mono" />
            </div>
          </div>
          <Button
            disabled={isPending || running || !token.trim() || !locationId.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await startGhlImport({ token, locationId });
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                setToken("");
                toast.success("Import partito: puoi restare qui o chiudere la pagina.");
                router.refresh();
              })
            }
          >
            <Download className="size-4" />
            {running ? "Import in corso…" : "Importa contatti e conversazioni"}
          </Button>
        </div>
      </Panel>

      {imports.length ? (
        <Panel title="Import">
          <ul className="divide-y divide-mint-border/70">
            {imports.map((i) => (
              <li key={i.id} className="space-y-1 px-5 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatDate(i.createdAt)}</span>
                  <Pill tone={i.status === "DONE" ? "mint" : i.status === "FAILED" ? "wine" : "amber"}>
                    {i.status === "DONE" ? "Completato" : i.status === "FAILED" ? "Non riuscito" : "In corso"}
                  </Pill>
                </div>
                <p className="text-muted-foreground">
                  Contatti letti {i.stats.contactsSeen ?? 0}, nuove clienti {i.stats.contactsCreated ?? 0} · conversazioni {i.stats.conversations ?? 0},
                  messaggi importati {i.stats.messagesImported ?? 0}
                  {i.stats.messagesSkipped ? ` (saltati ${i.stats.messagesSkipped} tra chiamate, email e note)` : ""}
                </p>
                {i.error ? <p className="text-destructive">{i.error}</p> : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
