import { z } from "zod";

export const consentTypeValues = ["PRIVACY_GDPR", "MARKETING", "TREATMENT"] as const;

export type ConsentTypeValue = (typeof consentTypeValues)[number];

export const consentTypeLabels: Record<ConsentTypeValue, string> = {
  PRIVACY_GDPR: "Privacy & GDPR",
  MARKETING: "Marketing / WhatsApp",
  TREATMENT: "Consenso informato trattamento",
};

export const consentTemplateFormSchema = z.object({
  type: z.enum(consentTypeValues),
  // Trattamenti per cui il consenso serve (solo per il tipo TREATMENT); vuoto = modello generico.
  serviceIds: z.array(z.string().min(1)).max(500),
  title: z.string().trim().min(1, "Il titolo è obbligatorio.").max(200, "Massimo 200 caratteri."),
  body: z
    .string()
    .trim()
    .min(1, "Il testo del consenso è obbligatorio.")
    .max(20000, "Massimo 20000 caratteri."),
  // Condizioni di salute da spuntare prima della firma, una per riga (solo TREATMENT).
  checklist: z.string().max(5000, "Massimo 5000 caratteri."),
  isActive: z.boolean(),
});

/** Righe non vuote del campo "condizioni" (una per riga, senza doppioni). */
export function parseChecklist(text: string): string[] {
  return [...new Set(text.split("\n").map((line) => line.trim()).filter(Boolean))].slice(0, 40);
}

export type ConsentTemplateFormValues = z.infer<typeof consentTemplateFormSchema>;

export const consentTemplateFormDefaultValues: ConsentTemplateFormValues = {
  type: "PRIVACY_GDPR",
  serviceIds: [],
  title: "",
  body: "",
  checklist: "",
  isActive: true,
};

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

export const collectConsentSchema = z.object({
  clientId: z.string().min(1),
  templateId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  // Dati della firma come data URL PNG prodotto dal canvas.
  signature: z
    .string()
    .startsWith(PNG_DATA_URL_PREFIX, "Firma non valida.")
    .max(1_000_000, "La firma è troppo grande."),
  // Solo per MARKETING può essere false (rifiuto esplicito firmato).
  granted: z.boolean(),
  anamnesis: z.string().trim().max(5000, "Massimo 5000 caratteri.").optional(),
  // Domande di salute del modello (se ne ha): voci spuntate e "Nessuna di queste".
  conditions: z.array(z.string().max(300)).max(50).optional(),
  noConditions: z.boolean().optional(),
});

export type CollectConsentValues = z.infer<typeof collectConsentSchema>;
export { PNG_DATA_URL_PREFIX };
