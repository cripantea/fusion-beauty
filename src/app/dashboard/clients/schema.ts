import { z } from "zod";

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
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const clientFormDefaultValues: ClientFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  notes: "",
};
