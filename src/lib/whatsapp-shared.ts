/**
 * Parti di WhatsApp senza accesso al database: le usano sia il server sia
 * le pagine di impostazione nel browser.
 */

export const TEMPLATE_VARIABLES = [
  { key: "nome", label: "Nome della cliente" },
  { key: "cognome", label: "Cognome" },
  { key: "centro", label: "Nome del centro" },
  { key: "trattamento", label: "Trattamento" },
  { key: "data", label: "Data appuntamento (es. martedì 12 novembre)" },
  { key: "ora", label: "Ora appuntamento (es. 15:30)" },
  { key: "operatrice", label: "Nome dell'operatrice" },
  { key: "prenota", label: "Link per prenotare online" },
  { key: "link", label: "Link del questionario" },
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number]["key"], string>>;

export function renderVariables(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (match, key: string) => {
    const value = vars[key.toLowerCase() as keyof TemplateVars];
    return value ?? match;
  });
}

/** Testo del template con {{1}}, {{2}}… sostituiti dai parametri (per lo storico della chat). */
export function fillTemplateBody(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (match, n: string) => params[Number(n) - 1] ?? match);
}
