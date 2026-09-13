"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  connectGoogleCalendarMock,
  disconnectGoogleCalendar,
  disconnectIcalImport,
  generateIcsFeedToken,
  saveIcalImportUrl,
  syncIcalImport,
  type IntegrationSettings,
} from "./actions";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
});

function subscribeNoop() {
  return () => {};
}

function getOriginSnapshot() {
  return window.location.origin;
}

function getOriginServerSnapshot() {
  return "";
}

type IntegrationsManagerProps = {
  initialSettings: IntegrationSettings;
};

export function IntegrationsManager({ initialSettings }: IntegrationsManagerProps) {
  const origin = useSyncExternalStore(
    subscribeNoop,
    getOriginSnapshot,
    getOriginServerSnapshot
  );
  const [settings, setSettings] = useState(initialSettings);
  const [icalUrl, setIcalUrl] = useState(settings.icalIntegration?.externalCalendarUrl ?? "");
  const [isPending, startTransition] = useTransition();

  const feedUrl =
    origin && settings.icsFeedToken
      ? `${origin}/api/calendar/${settings.tenantSlug}/feed.ics?token=${settings.icsFeedToken}`
      : null;

  function handleGenerateToken() {
    startTransition(async () => {
      const result = await generateIcsFeedToken();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSettings((current) => ({ ...current, icsFeedToken: result.token }));
      toast.success("Link del feed generato.");
    });
  }

  function handleCopyFeedUrl() {
    if (!feedUrl) return;
    navigator.clipboard
      .writeText(feedUrl)
      .then(() => toast.success("Link copiato negli appunti."))
      .catch(() => toast.error("Impossibile copiare il link."));
  }

  function handleConnectGoogle() {
    startTransition(async () => {
      const result = await connectGoogleCalendarMock();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Google Calendar collegato (demo).");
      setSettings((current) => ({
        ...current,
        googleIntegration: {
          id: current.googleIntegration?.id ?? "mock",
          type: "GOOGLE_CALENDAR",
          isEnabled: true,
          externalCalendarUrl: null,
          lastSyncedAt: current.googleIntegration?.lastSyncedAt ?? null,
          eventCount: current.googleIntegration?.eventCount ?? 0,
        },
      }));
    });
  }

  function handleDisconnectGoogle() {
    startTransition(async () => {
      const result = await disconnectGoogleCalendar();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Google Calendar disconnesso.");
      setSettings((current) =>
        current.googleIntegration
          ? { ...current, googleIntegration: { ...current.googleIntegration, isEnabled: false } }
          : current
      );
    });
  }

  function handleSaveIcalUrl() {
    startTransition(async () => {
      const result = await saveIcalImportUrl({ url: icalUrl });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("URL calendario salvato. Avvia la sincronizzazione per importare gli eventi.");
      setSettings((current) => ({
        ...current,
        icalIntegration: {
          id: current.icalIntegration?.id ?? "pending",
          type: "ICAL_URL",
          isEnabled: true,
          externalCalendarUrl: icalUrl,
          lastSyncedAt: current.icalIntegration?.lastSyncedAt ?? null,
          eventCount: current.icalIntegration?.eventCount ?? 0,
        },
      }));
    });
  }

  function handleSyncIcal() {
    startTransition(async () => {
      const result = await syncIcalImport();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.importedCount} eventi importati.`);
      setSettings((current) =>
        current.icalIntegration
          ? {
              ...current,
              icalIntegration: {
                ...current.icalIntegration,
                lastSyncedAt: new Date(),
                eventCount: result.importedCount,
              },
            }
          : current
      );
    });
  }

  function handleDisconnectIcal() {
    startTransition(async () => {
      const result = await disconnectIcalImport();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Importazione calendario disattivata.");
      setIcalUrl("");
      setSettings((current) => ({ ...current, icalIntegration: null }));
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrazioni calendario</h1>
        <p className="text-muted-foreground">
          Esporta gli appuntamenti del centro ed evita conflitti con impegni esterni.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Esportazione iCal/ICS</CardTitle>
          <CardDescription>
            Aggiungi questo link come calendario &quot;da URL&quot; in Apple Calendar, Outlook o
            Google Calendar per vedere gli appuntamenti del centro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedUrl ? (
            <>
              <pre className="overflow-x-auto rounded-lg border bg-muted p-3 text-xs">
                <code>{feedUrl}</code>
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCopyFeedUrl}>Copia link</Button>
                <Button variant="outline" disabled={isPending} onClick={handleGenerateToken}>
                  Rigenera link
                </Button>
              </div>
            </>
          ) : (
            <Button disabled={isPending || !origin} onClick={handleGenerateToken}>
              Genera link feed
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Google Calendar
            {settings.googleIntegration?.isEnabled ? (
              <Badge>Connesso</Badge>
            ) : (
              <Badge variant="secondary">Non connesso</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Integrazione dimostrativa: la connessione OAuth reale richiederebbe la registrazione
            di un&apos;app su Google Cloud Console, non disponibile in questo ambiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings.googleIntegration?.isEnabled ? (
            <Button variant="outline" disabled={isPending} onClick={handleDisconnectGoogle}>
              Disconnetti
            </Button>
          ) : (
            <Button disabled={isPending} onClick={handleConnectGoogle}>
              Connetti Google Calendar (demo)
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Importa calendario esterno
            {settings.icalIntegration?.isEnabled ? (
              <Badge>Attivo</Badge>
            ) : (
              <Badge variant="secondary">Non configurato</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Importa un calendario iCal esterno (URL .ics pubblico): i suoi eventi bloccheranno gli
            slot corrispondenti nell&apos;agenda interna e nel widget di prenotazione.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="https://esempio.it/calendario.ics"
              value={icalUrl}
              onChange={(event) => setIcalUrl(event.target.value)}
            />
            <Button disabled={isPending} onClick={handleSaveIcalUrl}>
              Salva
            </Button>
          </div>

          {settings.icalIntegration?.isEnabled ? (
            <>
              <p className="text-sm text-muted-foreground">
                {settings.icalIntegration.lastSyncedAt
                  ? `Ultima sincronizzazione: ${dateTimeFormatter.format(
                      new Date(settings.icalIntegration.lastSyncedAt)
                    )} — ${settings.icalIntegration.eventCount} eventi importati.`
                  : "Non ancora sincronizzato."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isPending} onClick={handleSyncIcal}>
                  Sincronizza ora
                </Button>
                <Button variant="outline" disabled={isPending} onClick={handleDisconnectIcal}>
                  Disattiva
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
