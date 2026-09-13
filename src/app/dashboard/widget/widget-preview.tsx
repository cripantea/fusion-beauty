"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type WidgetPreviewProps = {
  tenantSlug: string;
  tenantName: string;
};

function subscribeNoop() {
  return () => {};
}

function getOriginSnapshot() {
  return window.location.origin;
}

function getOriginServerSnapshot() {
  return "";
}

export function WidgetPreview({ tenantSlug, tenantName }: WidgetPreviewProps) {
  const origin = useSyncExternalStore(
    subscribeNoop,
    getOriginSnapshot,
    getOriginServerSnapshot
  );

  const embedUrl = origin ? `${origin}/embed/${tenantSlug}` : `/embed/${tenantSlug}`;
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="700" frameborder="0"></iframe>`;

  function handleCopy() {
    navigator.clipboard
      .writeText(embedCode)
      .then(() => toast.success("Codice embed copiato negli appunti."))
      .catch(() => toast.error("Impossibile copiare il codice."));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Widget di prenotazione</h1>
        <p className="text-muted-foreground">
          Incorpora il catalogo trattamenti di {tenantName} nel tuo sito web.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Codice embed</CardTitle>
          <CardDescription>
            Copia questo codice e incollalo nella pagina del tuo sito dove vuoi mostrare il
            widget.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="overflow-x-auto rounded-lg border bg-muted p-3 text-xs">
            <code>{embedCode}</code>
          </pre>
          <Button onClick={handleCopy} disabled={!origin}>
            Copia codice embed
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anteprima live</CardTitle>
          <CardDescription>Ecco come apparirà il widget ai tuoi clienti.</CardDescription>
        </CardHeader>
        <CardContent>
          {origin ? (
            <iframe
              src={embedUrl}
              width="100%"
              height={700}
              style={{ border: 0 }}
              className="rounded-lg"
              title={`Anteprima widget ${tenantName}`}
            />
          ) : (
            <div className="flex h-[700px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
              Caricamento anteprima...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
