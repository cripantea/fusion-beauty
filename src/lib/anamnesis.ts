/**
 * Anamnesi del consenso informato: condizioni spuntate dalla cliente (dalla lista del modello)
 * più una nota libera. Salvata in ConsentRecord.answers e stampata nel PDF come testo.
 */
export type AnamnesisAnswers = {
  /** Condizioni spuntate (solo voci della lista del modello). */
  conditions: string[];
  /** "Nessuna di queste" spuntato. */
  none: boolean;
  note: string;
};

export const emptyAnamnesis: AnamnesisAnswers = { conditions: [], none: false, note: "" };

/** Con una lista di condizioni la cliente deve rispondere: almeno una voce o "Nessuna di queste". */
export function isAnamnesisAnswered(checklist: string[], answers: AnamnesisAnswers) {
  return checklist.length === 0 || answers.none || answers.conditions.length > 0;
}

/** Tiene solo le voci della lista del modello (nell'ordine del modello). */
export function cleanAnamnesis(checklist: string[], answers: AnamnesisAnswers): AnamnesisAnswers {
  const conditions = checklist.filter((item) => answers.conditions.includes(item));
  return { conditions, none: conditions.length === 0 && answers.none, note: answers.note.trim().slice(0, 2000) };
}

/** Testo per il PDF e per lo storico (null se non c'è nulla da dire). */
export function formatAnamnesis(checklist: string[], answers: AnamnesisAnswers): string | null {
  const lines: string[] = [];
  if (checklist.length > 0) {
    lines.push(
      answers.conditions.length > 0
        ? `Condizioni dichiarate: ${answers.conditions.join("; ")}.`
        : answers.none
          ? "Dichiara di non avere nessuna delle condizioni elencate."
          : ""
    );
  }
  if (answers.note) lines.push(`Note: ${answers.note}`);
  const text = lines.filter(Boolean).join("\n");
  return text || null;
}
