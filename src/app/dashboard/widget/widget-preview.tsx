"use client";

import { Copy, ExternalLink, MessageCircle } from "lucide-react";
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
  return "https://beauty.fusionsoft.it";
}

export function WidgetPreview({ tenantSlug, tenantName }: WidgetPreviewProps) {
  const origin = useSyncExternalStore(
    subscribeNoop,
    getOriginSnapshot,
    getOriginServerSnapshot
  );

  const registerUrl = `${origin}/registra/${tenantSlug}`;
  const bookingUrl = `${origin}/embed/${tenantSlug}`;
  const embedCode = `<iframe src="${bookingUrl}" width="100%" height="700" frameborder="0"></iframe>`;

  function copyRegisterLink() {
    navigator.clipboard
      .writeText(registerUrl)
      .then(() => toast.success("Link copiato negli appunti."))
      .catch(() => toast.error("Impossibile copiare il link."));
  }

  function copyLink() {
    navigator.clipboard
      .writeText(bookingUrl)
      .then(() => toast.success("Link copiato negli appunti."))
      .catch(() => toast.error("Impossibile copiare il link."));
  }

  function copyEmbed() {
    navigator.clipboard
      .writeText(embedCode)
      .then(() => toast.success("Codice embed copiato negli appunti."))
      .catch(() => toast.error("Impossibile copiare il codice."));
  }

  const waText = encodeURIComponent(
    `Ciao! Puoi prenotare il tuo trattamento direttamente qui:\n${bookingUrl}`
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Widget di prenotazione</h1>
        <p className="text-muted-foreground">
          Il tuo link personale per ricevere prenotazioni online da {tenantName}.
        </p>
      </div>

      {/* Primary: client registration link */}
      <Card className="border-mint-border bg-mint-soft/40">
        <CardHeader>
          <CardTitle>Link registrazione nuova cliente</CardTitle>
          <CardDescription>
            Invia questo link a una nuova cliente: compila nome, telefono e consenso privacy.
            I suoi dati entrano subito nell&apos;archivio clienti.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-mint-border bg-white px-4 py-3">
            <ExternalLink className="size-4 shrink-0 text-mint-ink" />
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-forest">{registerUrl}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyRegisterLink} className="gap-2">
              <Copy className="size-4" />
              Copia link
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              nativeButton={false}
              render={
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Ciao! Registrati come cliente de ${tenantName} cliccando qui:\n${registerUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <MessageCircle className="size-4" />
              Invia su WhatsApp
            </Button>
            <Button
              variant="ghost"
              className="gap-2"
              nativeButton={false}
              render={<a href={registerUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="size-4" />
              Apri
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Secondary: booking link */}
      <Card>
        <CardHeader>
          <CardTitle>Link prenotazione appuntamento</CardTitle>
          <CardDescription>
            Per clienti che vogliono prenotare direttamente un servizio con data e ora.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3">
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-muted-foreground">{bookingUrl}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyLink} className="gap-2">
              <Copy className="size-4" />
              Copia link
            </Button>
            <Button
              variant="ghost"
              className="gap-2"
              nativeButton={false}
              render={<a href={bookingUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="size-4" />
              Apri
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Secondary: embed code */}
      <Card>
        <CardHeader>
          <CardTitle>Codice embed per il sito</CardTitle>
          <CardDescription>
            Incorpora il modulo di prenotazione direttamente nel tuo sito web.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="overflow-x-auto rounded-lg border bg-muted p-3 text-xs">
            <code>{embedCode}</code>
          </pre>
          <Button variant="outline" onClick={copyEmbed}>
            Copia codice embed
          </Button>
        </CardContent>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle>Anteprima live</CardTitle>
          <CardDescription>Così appare il modulo di prenotazione alle tue clienti.</CardDescription>
        </CardHeader>
        <CardContent>
          <iframe
            src={bookingUrl}
            width="100%"
            height={700}
            style={{ border: 0 }}
            className="rounded-lg"
            title={`Anteprima widget ${tenantName}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
