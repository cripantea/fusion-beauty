"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Eye, MessageCircle, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/boutique";
import { CopyCode } from "@/components/copy-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CLIENT_FIELD_LABELS,
  CLIENT_FIELDS,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  formProblem,
  type ClientFieldKey,
  type FormFieldDef,
  type FormFieldType,
  type FormInput,
} from "@/lib/forms";
import { cn } from "@/lib/utils";

import { saveForm } from "../actions";

const nativeSelectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Dati della scheda adatti a ciascun tipo di campo. */
const CLIENT_FIELDS_BY_TYPE: Record<FormFieldType, ClientFieldKey[]> = {
  text: ["firstName", "lastName", "fullName", "city", "notes"],
  email: ["email"],
  tel: ["phone"],
  textarea: ["notes"],
  select: ["interests", "city"],
  radio: ["interests"],
  checkbox: [],
  date: ["dateOfBirth"],
  number: [],
  content: [],
  image: [],
};

function makeKey(label: string, existing: string[]) {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 30) || "campo";
  let key = base;
  for (let i = 2; existing.includes(key); i++) key = `${base}_${i}`;
  return key;
}

export function FormBuilder({
  id,
  initial,
  version,
  embedCode,
  publicUrl,
  whatsappWelcome,
}: {
  id: string;
  initial: FormInput;
  version: number;
  embedCode: string;
  publicUrl: string;
  whatsappWelcome: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormInput>(initial);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const problem = formProblem(form);

  function update(patch: Partial<FormInput>) {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function updateSettings(patch: Partial<FormInput["settings"]>) {
    update({ settings: { ...form.settings, ...patch } });
  }

  function updateField(index: number, patch: Partial<FormFieldDef>) {
    update({ fields: form.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)) });
  }

  function moveField(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= form.fields.length) return;
    const fields = [...form.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    update({ fields });
  }

  function addField(type: FormFieldType) {
    const label = type === "content" ? "Testo" : FIELD_TYPE_LABELS[type];
    const field: FormFieldDef = {
      key: makeKey(label, form.fields.map((f) => f.key)),
      label,
      type,
      required: false,
      clientField: null,
      ...(type === "select" || type === "radio" ? { options: ["Opzione 1", "Opzione 2"] } : {}),
      ...(type === "content" ? { content: "Scrivi qui il testo da mostrare." } : {}),
      ...(type === "image" ? { imageUrl: "", imageWidth: 40, imageAlign: "center" as const } : {}),
    };
    update({ fields: [...form.fields, field] });
  }

  function save() {
    startTransition(async () => {
      const result = await saveForm(id, form);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success("Form salvato: sul sito si aggiorna entro un minuto.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Form"
        title={form.name || "Form senza nome"}
        description="Modifica campi e aspetto, poi salva: il codice nel sito resta lo stesso."
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/forms" />}>
              <ArrowLeft className="size-4" />
              Tutti i form
            </Button>
            <Button onClick={save} disabled={isPending || !dirty || problem !== null}>
              <Save className="size-4" />
              {isPending ? "Salvataggio…" : dirty ? "Salva" : "Salvato"}
            </Button>
          </>
        }
      />

      {problem ? (
        <p className="rounded-xl border border-amber-200 bg-amber-soft px-4 py-3 text-sm text-amber-ink">{problem}</p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Panel title="Generale">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nome interno" hint="Lo vedi solo tu, nell'elenco dei form.">
                <Input value={form.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field label="Titolo sul sito">
                <Input value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="Facoltativo" />
              </Field>
              <Field label="Dove compare">
                <select
                  className={nativeSelectClass}
                  value={form.displayMode}
                  onChange={(e) => update({ displayMode: e.target.value as FormInput["displayMode"] })}
                >
                  <option value="INLINE">Nella pagina, dove incolli il codice</option>
                  <option value="POPUP">Bolla in basso a destra (si apre al clic)</option>
                </select>
              </Field>
              <Field label="Stato">
                <label className="flex h-8 items-center gap-2 text-sm">
                  <Switch checked={form.enabled} onCheckedChange={(enabled) => update({ enabled })} />
                  {form.enabled ? "Attivo: riceve risposte" : "In pausa: non compare sul sito"}
                </label>
              </Field>
              {form.displayMode === "POPUP" ? (
                <div className="sm:col-span-2">
                  <Field label="Messaggio di benvenuto nella bolla">
                    <Input value={form.welcomeMessage} onChange={(e) => update({ welcomeMessage: e.target.value })} />
                  </Field>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel
            title="Campi"
            action={
              <Popover>
                <PopoverTrigger render={<Button size="sm" variant="outline" />}>
                  <Plus className="size-3.5" />
                  Aggiungi campo
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 p-1">
                  {FIELD_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addField(type)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      {FIELD_TYPE_LABELS[type]}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            }
          >
            <ol className="divide-y divide-mint-border/70">
              {form.fields.map((field, index) => (
                <li key={field.key} className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {index + 1}. {FIELD_TYPE_LABELS[field.type]}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Sposta su" onClick={() => moveField(index, -1)} disabled={index === 0}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Sposta giù"
                        onClick={() => moveField(index, 1)}
                        disabled={index === form.fields.length - 1}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Elimina campo"
                        onClick={() => update({ fields: form.fields.filter((_, i) => i !== index) })}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {field.type === "content" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Textarea value={field.content ?? ""} onChange={(e) => updateField(index, { content: e.target.value })} rows={3} />
                      </div>
                      <Field label="Dimensione (px)">
                        <OptionalNumber value={field.textSize} min={8} max={96} placeholder="14" onChange={(textSize) => updateField(index, { textSize })} />
                      </Field>
                      <Field label="Colore">
                        <OptionalColor value={field.textColor} onChange={(textColor) => updateField(index, { textColor })} />
                      </Field>
                      <Field label="Allineamento">
                        <AlignSelect value={field.textAlign} onChange={(textAlign) => updateField(index, { textAlign })} />
                      </Field>
                      <Field label="Link (facoltativo)">
                        <Input value={field.linkUrl ?? ""} onChange={(e) => updateField(index, { linkUrl: e.target.value })} placeholder="https://…" />
                      </Field>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={field.textBold ?? false} onCheckedChange={(textBold) => updateField(index, { textBold })} />
                        Grassetto
                      </label>
                    </div>
                  ) : field.type === "image" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Field label="Indirizzo dell'immagine" hint="Es. il logo caricato sul tuo sito (https://…).">
                          <Input value={field.imageUrl ?? ""} onChange={(e) => updateField(index, { imageUrl: e.target.value })} placeholder="https://iltuosito.it/logo.png" />
                        </Field>
                      </div>
                      <Field label="Descrizione (per chi non vede)">
                        <Input value={field.imageAlt ?? ""} onChange={(e) => updateField(index, { imageAlt: e.target.value })} />
                      </Field>
                      <Field label={`Larghezza (${field.imageWidth ?? 60}%)`}>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          value={field.imageWidth ?? 60}
                          onChange={(e) => updateField(index, { imageWidth: Number(e.target.value) })}
                          className="h-8 w-full accent-[var(--color-mint-ink)]"
                        />
                      </Field>
                      <Field label="Allineamento">
                        <AlignSelect value={field.imageAlign} onChange={(imageAlign) => updateField(index, { imageAlign })} />
                      </Field>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Etichetta">
                        <Input value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} />
                      </Field>
                      <Field label="Va nella scheda cliente come">
                        <select
                          className={nativeSelectClass}
                          value={field.clientField ?? ""}
                          onChange={(e) => updateField(index, { clientField: (e.target.value || null) as ClientFieldKey | null })}
                        >
                          <option value="">Solo nella risposta</option>
                          {CLIENT_FIELDS.filter((key) => CLIENT_FIELDS_BY_TYPE[field.type].includes(key) || key === field.clientField).map((key) => (
                            <option key={key} value={key}>
                              {CLIENT_FIELD_LABELS[key]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {field.type !== "checkbox" && field.type !== "radio" ? (
                        <Field label="Testo di esempio">
                          <Input
                            value={field.placeholder ?? ""}
                            onChange={(e) => updateField(index, { placeholder: e.target.value })}
                            placeholder="Facoltativo"
                          />
                        </Field>
                      ) : null}
                      <Field label="Aiuto sotto il campo">
                        <Input value={field.helpText ?? ""} onChange={(e) => updateField(index, { helpText: e.target.value })} placeholder="Facoltativo" />
                      </Field>
                      {field.type === "select" || field.type === "radio" ? (
                        <div className="sm:col-span-2">
                          <Field label="Opzioni (una per riga)">
                            <Textarea
                              rows={3}
                              value={(field.options ?? []).join("\n")}
                              onChange={(e) =>
                                updateField(index, {
                                  options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean),
                                })
                              }
                            />
                          </Field>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Switch checked={field.required} onCheckedChange={(required) => updateField(index, { required })} />
                          Obbligatorio
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch checked={field.half ?? false} onCheckedChange={(half) => updateField(index, { half })} />
                          Metà larghezza
                        </label>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Aspetto">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Colore principale" hint="Pulsante e bolla.">
                <ColorInput value={form.color} onChange={(color) => update({ color })} />
              </Field>
              <Field label="Sfondo del form">
                <ColorInput value={form.settings.formBg} onChange={(formBg) => updateSettings({ formBg })} />
              </Field>
              <Field label="Colore del testo">
                <ColorInput value={form.settings.textColor} onChange={(textColor) => updateSettings({ textColor })} />
              </Field>
              <Field label={`Arrotondamento (${form.settings.radius}px)`}>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={form.settings.radius}
                  onChange={(e) => updateSettings({ radius: Number(e.target.value) })}
                  className="h-8 w-full accent-[var(--color-mint-ink)]"
                />
              </Field>
              <Field label="Testo del pulsante">
                <Input value={form.settings.submitButtonText} onChange={(e) => updateSettings({ submitButtonText: e.target.value })} />
              </Field>
              <Field label="Carattere (Google Font)" hint="Es. Inter, Montserrat, Roboto. Vuoto = quello di sistema.">
                <Input
                  value={form.settings.fontFamily ?? ""}
                  onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                  placeholder="Automatico"
                />
              </Field>
            </div>
            <details className="group border-t border-mint-border/70">
              <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-mint-ink">
                Aspetto avanzato: card, campi, titolo, pulsante e CSS
              </summary>
              <div className="space-y-5 px-5 pb-5">
                <Section title="Card">
                  <Field label="Colore del bordo">
                    <OptionalColor value={form.settings.formBorderColor} onChange={(formBorderColor) => updateSettings({ formBorderColor })} />
                  </Field>
                  <Field label="Spessore del bordo (px)">
                    <OptionalNumber value={form.settings.formBorderWidth} max={20} placeholder="0" onChange={(formBorderWidth) => updateSettings({ formBorderWidth })} />
                  </Field>
                  <Field label="Arrotondamento card (px)">
                    <OptionalNumber value={form.settings.formBorderRadius} max={60} placeholder="16" onChange={(formBorderRadius) => updateSettings({ formBorderRadius })} />
                  </Field>
                  <Field label="Ombra">
                    <select
                      className={nativeSelectClass}
                      value={form.settings.formShadow ?? "none"}
                      onChange={(e) => updateSettings({ formShadow: e.target.value as "none" | "soft" | "strong" })}
                    >
                      <option value="none">Nessuna</option>
                      <option value="soft">Leggera</option>
                      <option value="strong">Marcata</option>
                    </select>
                  </Field>
                  <Field label="Spazio interno (px)">
                    <OptionalNumber value={form.settings.formPadding} max={120} placeholder="24" onChange={(formPadding) => updateSettings({ formPadding })} />
                  </Field>
                  <Field label="Larghezza massima (px)">
                    <OptionalNumber value={form.settings.formMaxWidth} min={200} max={2000} placeholder="520" onChange={(formMaxWidth) => updateSettings({ formMaxWidth })} />
                  </Field>
                </Section>
                <Section title="Campi">
                  <Field label="Sfondo dei campi">
                    <OptionalColor value={form.settings.fieldBg} onChange={(fieldBg) => updateSettings({ fieldBg })} />
                  </Field>
                  <Field label="Testo dei campi">
                    <OptionalColor value={form.settings.fieldTextColor} onChange={(fieldTextColor) => updateSettings({ fieldTextColor })} />
                  </Field>
                  <Field label="Bordo dei campi">
                    <OptionalColor value={form.settings.fieldBorderColor} onChange={(fieldBorderColor) => updateSettings({ fieldBorderColor })} />
                  </Field>
                  <Field label="Spessore bordo campi (px)">
                    <OptionalNumber value={form.settings.fieldBorderWidth} max={10} placeholder="1" onChange={(fieldBorderWidth) => updateSettings({ fieldBorderWidth })} />
                  </Field>
                  <Field label="Testo di esempio">
                    <OptionalColor value={form.settings.placeholderColor} onChange={(placeholderColor) => updateSettings({ placeholderColor })} />
                  </Field>
                  <Field label="Etichette">
                    <OptionalColor value={form.settings.labelColor} onChange={(labelColor) => updateSettings({ labelColor })} />
                  </Field>
                  <Field label="Spazio tra i campi (px)">
                    <OptionalNumber value={form.settings.fieldGap} max={60} placeholder="14" onChange={(fieldGap) => updateSettings({ fieldGap })} />
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-1 text-sm">
                    <Switch checked={form.settings.hideLabels ?? false} onCheckedChange={(hideLabels) => updateSettings({ hideLabels })} />
                    Nascondi le etichette (restano i testi di esempio)
                  </label>
                </Section>
                <Section title="Titolo, testi piccoli e pulsante">
                  <Field label="Colore del titolo">
                    <OptionalColor value={form.settings.titleColor} onChange={(titleColor) => updateSettings({ titleColor })} />
                  </Field>
                  <Field label="Dimensione del titolo (px)">
                    <OptionalNumber value={form.settings.titleSize} min={10} max={72} placeholder="20" onChange={(titleSize) => updateSettings({ titleSize })} />
                  </Field>
                  <Field label="Allineamento del titolo">
                    <AlignSelect value={form.settings.titleAlign} onChange={(titleAlign) => updateSettings({ titleAlign })} />
                  </Field>
                  <Field label="Testi piccoli (consenso, link)">
                    <OptionalColor value={form.settings.smallTextColor} onChange={(smallTextColor) => updateSettings({ smallTextColor })} />
                  </Field>
                  <Field label="Testo del pulsante (colore)">
                    <OptionalColor value={form.settings.buttonTextColor} onChange={(buttonTextColor) => updateSettings({ buttonTextColor })} />
                  </Field>
                  <Field label="Arrotondamento pulsante (px)">
                    <OptionalNumber value={form.settings.buttonRadius} max={60} placeholder={String(form.settings.radius)} onChange={(buttonRadius) => updateSettings({ buttonRadius })} />
                  </Field>
                </Section>
                <Field
                  label="CSS personalizzato"
                  hint="Vale solo dentro il form. Classi: .fc-card, .fc-title, .fc-field, .fc-text, .fc-image, .fc-privacy, .fc-submit, .fc-links (le stesse dei form del CRM)."
                >
                  <Textarea
                    rows={5}
                    className="font-mono text-xs"
                    value={form.settings.customCss ?? ""}
                    onChange={(e) => updateSettings({ customCss: e.target.value })}
                    placeholder=".fc-submit { text-transform: uppercase; }"
                  />
                </Field>
              </div>
            </details>
          </Panel>

          <Panel title="Privacy e invio">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.settings.requirePrivacyConsent}
                    onCheckedChange={(requirePrivacyConsent) => updateSettings({ requirePrivacyConsent })}
                  />
                  Chiedi il consenso privacy (consigliato)
                </label>
              </div>
              {form.settings.requirePrivacyConsent ? (
                <>
                  <div className="sm:col-span-2">
                    <Field label="Testo del consenso">
                      <Textarea rows={2} value={form.settings.privacyText} onChange={(e) => updateSettings({ privacyText: e.target.value })} />
                    </Field>
                  </div>
                </>
              ) : null}
              <Field label="Link all'informativa privacy" hint="Compare sotto il pulsante.">
                <Input
                  value={form.settings.privacyPolicyUrl}
                  onChange={(e) => updateSettings({ privacyPolicyUrl: e.target.value })}
                  placeholder="https://iltuosito.it/privacy"
                />
              </Field>
              <Field label="Testo del link privacy">
                <Input
                  value={form.settings.privacyLinkText ?? ""}
                  onChange={(e) => updateSettings({ privacyLinkText: e.target.value })}
                  placeholder="Informativa privacy"
                />
              </Field>
              <Field label="Link ai termini e condizioni">
                <Input
                  value={form.settings.termsUrl ?? ""}
                  onChange={(e) => updateSettings({ termsUrl: e.target.value })}
                  placeholder="https://iltuosito.it/termini"
                />
              </Field>
              <Field label="Testo del link termini">
                <Input
                  value={form.settings.termsLinkText ?? ""}
                  onChange={(e) => updateSettings({ termsLinkText: e.target.value })}
                  placeholder="Termini e condizioni"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Nota in fondo al form" hint="Facoltativa, es. “Rispondiamo entro 24 ore”.">
                  <Input value={form.settings.footerText ?? ""} onChange={(e) => updateSettings({ footerText: e.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Messaggio dopo l'invio">
                  <Textarea rows={2} value={form.settings.successMessage} onChange={(e) => updateSettings({ successMessage: e.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Oppure porta a una pagina" hint="Facoltativo, es. la pagina “Grazie” del sito.">
                  <Input
                    value={form.settings.redirectUrl}
                    onChange={(e) => updateSettings({ redirectUrl: e.target.value })}
                    placeholder="https://iltuosito.it/grazie"
                  />
                </Field>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-mint-border bg-mint-soft/40 p-3 text-sm sm:col-span-2">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-mint-ink" />
                <p>
                  {whatsappWelcome
                    ? "Chi compila il form riceve subito il tuo messaggio WhatsApp automatico."
                    : "Puoi far arrivare un messaggio WhatsApp automatico a chi compila il form."}{" "}
                  <Link href="/dashboard/automations" className="font-medium underline">
                    Automazioni
                  </Link>
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Panel
            title="Anteprima"
            icon={Eye}
            action={dirty ? <span className="text-xs text-amber-ink">Salva per aggiornarla</span> : null}
          >
            {initial.enabled ? (
              <iframe
                key={version}
                src={`${publicUrl}?v=${version}`}
                title="Anteprima del form"
                className={cn("h-[560px] w-full border-0 bg-muted/40", dirty && "opacity-60")}
              />
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Il form è in pausa: attivalo e salva per vederlo.</p>
            )}
          </Panel>
          <Panel title="Codice per il sito">
            <div className="space-y-3 p-5">
              <p className="text-sm text-muted-foreground">
                Incollalo nella pagina del sito (in WordPress: blocco “HTML personalizzato”). Le modifiche salvate qui arrivano da sole.
              </p>
              <CopyCode code={embedCode} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-0.5"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/** Colore facoltativo: vuoto = automatico. */
function OptionalColor({ value, onChange }: { value: string | undefined; onChange: (value: string | undefined) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-0.5"
      />
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} placeholder="Automatico" className="font-mono" />
    </div>
  );
}

/** Numero facoltativo: vuoto = valore standard (il segnaposto). */
function OptionalNumber({
  value,
  onChange,
  min = 0,
  max,
  placeholder,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max: number;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(undefined);
        const n = Math.round(Number(raw));
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
    />
  );
}

type Align = "left" | "center" | "right";

function AlignSelect({ value, onChange }: { value: Align | undefined; onChange: (value: Align | undefined) => void }) {
  return (
    <select className={nativeSelectClass} value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as Align | undefined)}>
      <option value="">Automatico</option>
      <option value="left">A sinistra</option>
      <option value="center">Al centro</option>
      <option value="right">A destra</option>
    </select>
  );
}
