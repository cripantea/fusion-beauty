import { z } from "zod";

// Codice fiscale italiano (16 caratteri, omocodia inclusa). Il checksum non è verificato.
const TAX_CODE_PATTERN = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i;

/** Valida una data "yyyy-MM-dd" reale, non futura e non anteriore al 1900. */
function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;

  return date.getUTCFullYear() >= 1900 && date.getTime() <= Date.now();
}

export const clientFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Il nome è obbligatorio.")
    .max(100, "Massimo 100 caratteri."),
  lastName: z
    .string()
    .trim()
    .min(1, "Il cognome è obbligatorio.")
    .max(100, "Massimo 100 caratteri."),
  phone: z
    .string()
    .trim()
    .min(1, "Il telefono è obbligatorio.")
    .max(30, "Massimo 30 caratteri."),
  email: z
    .string()
    .trim()
    .email("Inserisci un'email valida.")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(2000, "Massimo 2000 caratteri.").optional(),
  dateOfBirth: z
    .string()
    .refine((value) => value === "" || isValidBirthDate(value), "Inserisci una data di nascita valida."),
  taxCode: z
    .string()
    .trim()
    .refine((value) => value === "" || TAX_CODE_PATTERN.test(value), "Codice fiscale non valido."),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const clientFormDefaultValues: ClientFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  notes: "",
  dateOfBirth: "",
  taxCode: "",
};
