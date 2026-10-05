"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { registerClient } from "./actions";

type RegisterFormProps = {
  slug: string;
  centerName: string;
};

export function RegisterForm({ slug, centerName }: RegisterFormProps) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacyError, setPrivacyError] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = "Il nome è obbligatorio.";
    if (!form.lastName.trim()) errors.lastName = "Il cognome è obbligatorio.";
    if (!form.phone.trim()) errors.phone = "Il telefono è obbligatorio.";
    setFieldErrors(errors);

    if (!privacyConsent) {
      setPrivacyError("Devi accettare il trattamento dei dati per procedere.");
      if (Object.keys(errors).length === 0) {
        // Focus privacy section
      }
    } else {
      setPrivacyError("");
    }

    if (Object.keys(errors).length > 0 || !privacyConsent) return;

    startTransition(async () => {
      const result = await registerClient(slug, form);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Check className="size-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Grazie, {form.firstName}!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            I tuoi dati sono stati registrati. {centerName} ti contatterà presto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Nome <span className="text-destructive">*</span></Label>
          <Input
            id="firstName"
            placeholder="Maria"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
          />
          {fieldErrors.firstName && <p className="text-xs text-destructive">{fieldErrors.firstName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Cognome <span className="text-destructive">*</span></Label>
          <Input
            id="lastName"
            placeholder="Rossi"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
          />
          {fieldErrors.lastName && <p className="text-xs text-destructive">{fieldErrors.lastName}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefono <span className="text-destructive">*</span></Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+39 333 1234567"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">
          Email <span className="text-muted-foreground font-normal">(facoltativa)</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="maria@esempio.it"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Note <span className="text-muted-foreground font-normal">(facoltative)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Preferenze, allergie, trattamenti di interesse..."
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>

      {/* Privacy */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(e) => {
              setPrivacyConsent(e.target.checked);
              if (e.target.checked) setPrivacyError("");
            }}
            className="mt-0.5 size-4 shrink-0 accent-primary cursor-pointer"
          />
          <span className="text-sm text-foreground/80 leading-snug">
            Acconsento al trattamento dei miei dati personali ai sensi del Regolamento UE 2016/679 (GDPR)
            da parte di <strong>{centerName}</strong> per la gestione del rapporto cliente e le comunicazioni
            inerenti ai trattamenti estetici. <span className="text-destructive">*</span>
          </span>
        </label>
        {privacyError && (
          <p className="pl-7 text-xs text-destructive">{privacyError}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isPending}>
        {isPending ? "Registrazione in corso..." : "Registrati"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        I tuoi dati vengono trattati esclusivamente da {centerName}.
      </p>
    </form>
  );
}
