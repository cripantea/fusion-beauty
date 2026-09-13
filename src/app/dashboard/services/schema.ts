import { z } from "zod";

export const serviceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Il nome è obbligatorio.")
    .max(200, "Massimo 200 caratteri."),
  description: z
    .string()
    .trim()
    .max(2000, "Massimo 2000 caratteri.")
    .optional(),
  price: z.coerce
    .number({ error: "Inserisci un prezzo valido." })
    .positive("Il prezzo deve essere maggiore di zero."),
  durationMinutes: z.coerce
    .number({ error: "Inserisci una durata valida." })
    .int("La durata deve essere un numero intero di minuti.")
    .positive("La durata deve essere maggiore di zero."),
  isOnlineBookingEnabled: z.boolean(),
});

export type ServiceFormInput = z.input<typeof serviceFormSchema>;
export type ServiceFormValues = z.output<typeof serviceFormSchema>;

export const serviceFormDefaultValues: ServiceFormInput = {
  name: "",
  description: "",
  price: 0,
  durationMinutes: 30,
  isOnlineBookingEnabled: true,
};
