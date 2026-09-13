import { z } from "zod";

export const APPOINTMENT_STATUSES = [
  "BOOKED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type AppointmentStatusValue = (typeof APPOINTMENT_STATUSES)[number];

export const NO_OPERATOR_VALUE = "none";

/** react-hook-form schema for the raw dialog fields (date/time kept separate). */
export const appointmentFormSchema = z.object({
  clientId: z.string().min(1, "Seleziona un cliente."),
  serviceId: z.string().min(1, "Seleziona un trattamento."),
  operatorId: z.string(),
  date: z.string().min(1, "Seleziona una data."),
  time: z.string().min(1, "Seleziona un orario."),
  durationMinutes: z.coerce
    .number({ error: "Inserisci una durata valida." })
    .int("La durata deve essere un numero intero di minuti.")
    .positive("La durata deve essere maggiore di zero."),
  notes: z.string().trim().max(2000, "Massimo 2000 caratteri.").optional(),
});

export type AppointmentFormInput = z.input<typeof appointmentFormSchema>;
export type AppointmentFormValues = z.output<typeof appointmentFormSchema>;

export const appointmentFormDefaultValues: AppointmentFormInput = {
  clientId: "",
  serviceId: "",
  operatorId: NO_OPERATOR_VALUE,
  date: "",
  time: "",
  durationMinutes: 30,
  notes: "",
};

/**
 * The payload actually sent to the Server Actions: date + time are combined
 * client-side into a single Date (so the browser's timezone is used, not the
 * server's) before crossing the action boundary.
 */
export const appointmentInputSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.string().min(1),
  operatorId: z.string().nullable(),
  startTime: z.date(),
  durationMinutes: z.coerce.number().int().positive(),
  notes: z.string().trim().max(2000).optional(),
});

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
