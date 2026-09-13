import { z } from "zod";

export const getSlotsSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  date: z.string().min(1),
});

export const contactFormSchema = z.object({
  firstName: z.string().trim().min(1, "Il nome è obbligatorio.").max(100),
  lastName: z.string().trim().min(1, "Il cognome è obbligatorio.").max(100),
  phone: z.string().trim().min(1, "Il telefono è obbligatorio.").max(30),
  email: z
    .string()
    .trim()
    .email("Inserisci un'email valida.")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(2000, "Massimo 2000 caratteri.").optional(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const contactFormDefaultValues: ContactFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  notes: "",
};

export const createBookingSchema = z
  .object({
    slug: z.string().min(1),
    serviceId: z.string().min(1),
    startTime: z.string().min(1),
  })
  .merge(contactFormSchema);

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
