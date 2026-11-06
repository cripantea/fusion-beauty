import type { WhatsappAutomationKind } from "@/generated/prisma/browser";

/**
 * Parti di WhatsApp senza accesso al database: le usano sia il server sia
 * le pagine di impostazione nel browser.
 */

export const AUTOMATION_KINDS: WhatsappAutomationKind[] = [
  "BOOKING_REQUEST",
  "BOOKING_CONFIRMED",
  "REMINDER",
  "BIRTHDAY",
  "FORM_WELCOME",
  "QUESTIONNAIRE",
];

export const AUTOMATION_INFO: Record<WhatsappAutomationKind, { title: string; description: string; example: string }> = {
  BOOKING_REQUEST: {
    title: "Richiesta di prenotazione ricevuta",
    description: "Quando una cliente prenota dal widget online (prima che tu la confermi).",
    example: "Ciao {{nome}}, abbiamo ricevuto la tua richiesta per {{trattamento}} il {{data}} alle {{ora}}. Ti confermiamo a breve!",
  },
  BOOKING_CONFIRMED: {
    title: "Appuntamento confermato",
    description: "Quando confermi una richiesta online o crei un appuntamento in agenda.",
    example: "Ciao {{nome}}, ti confermiamo {{trattamento}} il {{data}} alle {{ora}}. A presto da {{centro}}!",
  },
  REMINDER: {
    title: "Promemoria del giorno prima",
    description: "Il giorno prima dell'appuntamento, dalle 10 in poi.",
    example: "Ciao {{nome}}, ti ricordiamo l'appuntamento di domani alle {{ora}} per {{trattamento}}. Ti aspettiamo!",
  },
  BIRTHDAY: {
    title: "Auguri di compleanno",
    description: "Il giorno del compleanno, dalle 9 in poi (serve la data di nascita nella scheda).",
    example: "Buon compleanno {{nome}}! 🎉 Tutto lo staff di {{centro}} ti fa i migliori auguri.",
  },
  FORM_WELCOME: {
    title: "Risposta a un form del sito",
    description: "Subito dopo che una persona compila un form incorporato nel sito.",
    example: "Ciao {{nome}}, grazie per averci scritto! Prenota quando vuoi qui: {{prenota}}",
  },
  QUESTIONNAIRE: {
    title: "Questionario nuova cliente",
    description: "Quando crei una nuova cliente veloce: invia il link al questionario.",
    example: "Ciao {{nome}}, benvenuta da {{centro}}! Compila la tua scheda qui: {{link}}",
  },
};

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
