"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { submitQuestionnaire } from "./actions";
import { ACQUISITION_SOURCES, type QuestionnaireValues } from "./schema";

type QuestionnaireFormProps = {
  token: string;
  alreadyCompleted: boolean;
  hasEmail: boolean;
  services: string[];
  tenantName: string;
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-forest bg-forest text-forest-foreground"
          : "border-mint-border bg-card text-foreground hover:bg-mint-soft"
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function QuestionnaireForm({
  token,
  alreadyCompleted,
  hasEmail,
  services,
  tenantName,
}: QuestionnaireFormProps) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(alreadyCompleted);
  const [values, setValues] = useState<QuestionnaireValues>({
    dateOfBirth: "",
    city: "",
    email: "",
    allergies: "",
    healthNotes: "",
    interests: [],
    acquisitionSource: "",
  });

  function patch(update: Partial<QuestionnaireValues>) {
    setValues((current) => ({ ...current, ...update }));
  }

  function toggleInterest(name: string) {
    patch({
      interests: values.interests.includes(name)
        ? values.interests.filter((item) => item !== name)
        : [...values.interests, name],
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await submitQuestionnaire(token, values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-mint-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint-soft text-mint-ink">
          <CheckCircle2 className="size-7" />
        </div>
        <h2 className="mt-4 font-heading text-2xl font-bold">Grazie!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Abbiamo salvato le tue risposte. Ti aspettiamo da {tenantName}.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-2xl border border-mint-border bg-card p-5 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data di nascita" hint="Per un pensiero nel tuo giorno speciale 🎂">
          <Input
            type="date"
            className="h-11"
            max={new Date().toISOString().slice(0, 10)}
            value={values.dateOfBirth}
            onChange={(event) => patch({ dateOfBirth: event.target.value })}
          />
        </Field>
        <Field label="Città">
          <Input
            className="h-11"
            placeholder="Es. Vigevano"
            value={values.city}
            onChange={(event) => patch({ city: event.target.value })}
          />
        </Field>
      </div>

      {hasEmail ? null : (
        <Field label="Email" hint="Facoltativa">
          <Input
            type="email"
            className="h-11"
            value={values.email}
            onChange={(event) => patch({ email: event.target.value })}
          />
        </Field>
      )}

      <Field label="Hai allergie?" hint="Es. nichel, profumi, lattice, farmaci">
        <Textarea
          rows={2}
          placeholder="Nessuna, oppure scrivile qui"
          value={values.allergies}
          onChange={(event) => patch({ allergies: event.target.value })}
        />
      </Field>

      <Field
        label="Pelle e salute"
        hint="Pelle sensibile, gravidanza, terapie in corso o altro che dobbiamo sapere"
      >
        <Textarea
          rows={3}
          value={values.healthNotes}
          onChange={(event) => patch({ healthNotes: event.target.value })}
        />
      </Field>

      {services.length > 0 ? (
        <Field label="Cosa ti interessa?" hint="Puoi sceglierne più di uno">
          <div className="flex flex-wrap gap-2">
            {services.map((name) => (
              <Chip
                key={name}
                active={values.interests.includes(name)}
                onClick={() => toggleInterest(name)}
              >
                {name}
              </Chip>
            ))}
          </div>
        </Field>
      ) : null}

      <Field label="Come ci hai conosciuto?">
        <div className="flex flex-wrap gap-2">
          {ACQUISITION_SOURCES.map((source) => (
            <Chip
              key={source}
              active={values.acquisitionSource === source}
              onClick={() =>
                patch({ acquisitionSource: values.acquisitionSource === source ? "" : source })
              }
            >
              {source}
            </Chip>
          ))}
        </div>
      </Field>

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={isPending}>
        {isPending ? "Invio..." : "Invia le mie risposte"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Le informazioni sono visibili solo allo staff del centro.
      </p>
    </form>
  );
}
