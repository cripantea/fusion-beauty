"use client";

import { useState } from "react";

import { CopyCode } from "@/components/copy-code";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bookingEmbedCode } from "@/lib/embed-code";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "inline", title: "Agenda nella pagina", description: "Il calendario compare dove incolli il codice." },
  { value: "button", title: "Pulsante", description: "Un pulsante nella pagina apre l'agenda in una finestra." },
  { value: "popup", title: "Pulsante flottante", description: "Sempre visibile in basso a destra, su tutto il sito." },
] as const;

/** Codice script per mettere l'agenda di prenotazione in qualsiasi sito. */
export function BookingEmbedCard({ origin, slug }: { origin: string; slug: string }) {
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("inline");
  const [text, setText] = useState("Prenota un trattamento");
  const [color, setColor] = useState("#1f3d36");

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
        <div className="grid gap-2 sm:grid-cols-3">
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

        {mode !== "inline" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Testo del pulsante</Label>
              <Input value={text} maxLength={60} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Colore del pulsante</Label>
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
        ) : null}

        <CopyCode code={bookingEmbedCode(origin, slug, { mode, text, color })} />
      </CardContent>
    </Card>
  );
}
