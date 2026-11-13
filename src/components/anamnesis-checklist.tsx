"use client";

import { Textarea } from "@/components/ui/textarea";
import type { AnamnesisAnswers } from "@/lib/anamnesis";

type AnamnesisChecklistProps = {
  checklist: string[];
  value: AnamnesisAnswers;
  onChange: (value: AnamnesisAnswers) => void;
};

/** Domande di salute prima della firma: spunta le condizioni oppure "Nessuna di queste". */
export function AnamnesisChecklist({ checklist, value, onChange }: AnamnesisChecklistProps) {
  function toggle(item: string) {
    const conditions = value.conditions.includes(item)
      ? value.conditions.filter((condition) => condition !== item)
      : [...value.conditions, item];
    onChange({ ...value, conditions, none: false });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Hai una di queste condizioni?</p>
        <p className="text-xs text-muted-foreground">Spunta quelle che ti riguardano, oppure &quot;Nessuna di queste&quot;.</p>
      </div>
      <div className="divide-y rounded-xl border">
        {checklist.map((item) => (
          <label key={item} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-mint-soft/40">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-forest"
              checked={value.conditions.includes(item)}
              onChange={() => toggle(item)}
            />
            {item}
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm font-medium hover:bg-mint-soft/40">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-forest"
            checked={value.none}
            onChange={() => onChange({ ...value, none: !value.none, conditions: [] })}
          />
          Nessuna di queste
        </label>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Altro da segnalare (facoltativo)</p>
        <Textarea
          rows={2}
          maxLength={2000}
          value={value.note}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
          placeholder="Farmaci che prendi, allergie, altro…"
        />
      </div>
    </div>
  );
}
