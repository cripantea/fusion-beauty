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
  // "" = nessun trattamento associato (ha senso solo per il tipo TREATMENT).
  serviceId: z.string(),
  title: z.string().trim().min(1, "Il titolo è obbligatorio.").max(200, "Massimo 200 caratteri."),
  body: z
    .string()
    .trim()
    .min(1, "Il testo del consenso è obbligatorio.")
    .max(20000, "Massimo 20000 caratteri."),
  isActive: z.boolean(),
});

export type ConsentTemplateFormValues = z.infer<typeof consentTemplateFormSchema>;

export const consentTemplateFormDefaultValues: ConsentTemplateFormValues = {
  type: "PRIVACY_GDPR",
  serviceId: "",
  title: "",
  body: "",
  isActive: true,
};
