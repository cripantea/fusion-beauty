"use client";

import { useState } from "react";

import { CopyCode } from "@/components/copy-code";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { bookingEmbedCode, bookingPageUrl } from "@/lib/embed-code";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "inline", title: "Agenda nella pagina", description: "Il calendario compare dove incolli il codice." },
  { value: "button", title: "Pulsante", description: "Un pulsante nella pagina apre l'agenda in una finestra." },
  { value: "popup", title: "Pulsante flottante", description: "Sempre visibile in basso a destra, su tutto il sito." },
  {
    value: "link",
    title: "Pulsanti del sito",
    description: "I tuoi pulsanti “Prenota ora” aprono l'agenda: aggiungi data-fusion-beauty-booking.",
  },
] as const;

/** Codice script per mettere l'agenda di prenotazione in qualsiasi sito. */
export function BookingEmbedCard({
  origin,
  slug,
  services,
}: {
  origin: string;
  slug: string;
  services: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("inline");
  const [text, setText] = useState("Prenota un trattamento");
  const [color, setColor] = useState("#1f3d36");
  // Agenda personalizzata: nessun trattamento scelto = tutti
  const [selected, setSelected] = useState<string[]>([]);
  const [tint, setTint] = useState(false);
  const [header, setHeader] = useState(true);

  function toggleService(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda di prenotazione nel tuo sito</CardTitle>
        <CardDescription>
          Copia il codice e incollalo nel sito (WordPress: blocco “HTML personalizzato”). L&apos;agenda si adatta da sola
          all&apos;altezza e mostra sempre gli orari liberi aggiornati.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                mode === option.value ? "border-mint-ink bg-mint-soft" : "border-border hover:bg-muted/50"
              )}
            >
              <div className="text-sm font-semibold">{option.title}</div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {mode === "button" || mode === "popup" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Testo del pulsante</Label>
              <Input value={text} maxLength={60} onChange={(e) => setText(e.target.value)} />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Colore {mode === "button" || mode === "popup" ? "del pulsante" : "dell'agenda"}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-0.5"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground">
            Trattamenti in questa agenda {selected.length ? `(${selected.length})` : "(tutti)"}
          </Label>
          <p className="text-xs text-muted-foreground">
            Per una pagina dedicata (es. Epilazione laser) scegli solo i trattamenti di quella pagina. Con un solo trattamento
            l&apos;agenda parte direttamente da data e ora.
          </p>
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => toggleService(service.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  selected.includes(service.id) ? "border-mint-ink bg-mint-soft font-medium" : "border-border hover:bg-muted/50"
                )}
              >
                {service.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={tint} onCheckedChange={setTint} />
            Usa il colore anche dentro l&apos;agenda
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={header} onCheckedChange={setHeader} />
            Mostra logo e nome del centro
          </label>
        </div>

        <CopyCode code={bookingEmbedCode(origin, slug, { mode, text, color, services: selected, tint, header })} />
        {mode === "link" ? (
          <p className="text-xs text-muted-foreground">
            Poi, a ogni pulsante che deve aprire l&apos;agenda, aggiungi{" "}
            <code className="rounded bg-muted px-1">data-fusion-beauty-booking</code>, es.{" "}
            <code className="rounded bg-muted px-1">&lt;a href=&quot;#&quot; data-fusion-beauty-booking&gt;Prenota ora&lt;/a&gt;</code>
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            Link diretto (Google Business “Prenota”, Instagram, WhatsApp)
          </Label>
          <CopyCode code={bookingPageUrl(origin, slug, { services: selected, color: tint ? color : undefined })} />
        </div>
      </CardContent>
    </Card>
  );
}
