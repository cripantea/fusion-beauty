"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FusionWaTemplate } from "@/lib/fusion-wa";
import { toMetaTemplate } from "@/lib/whatsapp-templates";

export type TemplateChoice = { templateName: string; language: string; templateBody: string; params: string[] };

const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";

/**
 * Scelta di un template approvato e di cosa mettere al posto di {{1}}, {{2}}…
 * Se il template è stato creato dal testo suggerito, le variabili si
 * compilano da sole nell'ordine giusto.
 */
export function TemplatePicker({
  templates,
  loaded,
  value,
  onChange,
  variables,
  suggestedText,
  onCreateTemplate,
}: {
  templates: FusionWaTemplate[];
  loaded: boolean;
  value: TemplateChoice;
  onChange: (value: TemplateChoice) => void;
  variables: { key: string; label: string }[];
  suggestedText?: string;
  onCreateTemplate?: () => void;
}) {
  const approved = templates.filter((t) => t.status === "APPROVED");
  const selected = approved.find((t) => t.name === value.templateName && t.language === value.language);
  const missing = loaded && value.templateName !== "" && !selected;
  const variableCount = selected?.variableCount ?? value.params.length;

  function choose(key: string) {
    const template = approved.find((t) => `${t.name}|${t.language}` === key);
    if (!template) {
      onChange({ templateName: "", language: "it", templateBody: "", params: [] });
      return;
    }
    const suggested = suggestedText ? toMetaTemplate(suggestedText) : null;
    const params = Array.from({ length: template.variableCount }, (_, i) =>
      suggested && template.body === suggested.body ? (suggested.params[i] ?? "") : (value.params[i] ?? (i === 0 ? "{{nome}}" : ""))
    );
    onChange({ templateName: template.name, language: template.language, templateBody: template.body, params });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Template da inviare</Label>
          <select className={selectClass} value={value.templateName ? `${value.templateName}|${value.language}` : ""} onChange={(e) => choose(e.target.value)}>
            <option value="">{!loaded ? "Caricamento…" : approved.length ? "Scegli un template approvato…" : "Nessun template approvato"}</option>
            {missing ? <option value={`${value.templateName}|${value.language}`}>{value.templateName} (non approvato al momento)</option> : null}
            {approved.map((t) => (
              <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                {t.name} ({t.language})
              </option>
            ))}
          </select>
        </div>
        {onCreateTemplate ? (
          <Button type="button" variant="outline" size="sm" onClick={onCreateTemplate}>
            <Sparkles className="size-3.5" />
            {suggestedText ? "Crea con testo suggerito" : "Nuovo template"}
          </Button>
        ) : null}
      </div>

      {value.templateBody ? <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">{value.templateBody}</p> : null}

      {variableCount > 0 && value.templateName ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Cosa mettere al posto delle variabili. Puoi usare:{" "}
            {variables.map((v) => (
              <code key={v.key} title={v.label} className="mr-1 rounded bg-muted px-1">{`{{${v.key}}}`}</code>
            ))}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: variableCount }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{`{{${i + 1}}}`}</span>
                <Input
                  value={value.params[i] ?? ""}
                  onChange={(e) => {
                    const params = Array.from({ length: variableCount }, (_, j) => value.params[j] ?? "");
                    params[i] = e.target.value;
                    onChange({ ...value, params });
                  }}
                  placeholder="es. {{nome}}"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
