import { z } from "zod";

export const ACQUISITION_SOURCES = [
  "Passaparola",
  "Instagram",
  "Facebook",
  "Google",
  "Passando davanti al centro",
  "Altro",
] as const;

export const questionnaireSchema = z.object({
  dateOfBirth: z
    .string()
    .refine((value) => {
      if (value === "") return true;
      const date = new Date(`${value}T00:00:00.000Z`);
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value &&
        date.getUTCFullYear() >= 1900 &&
        date.getTime() <= Date.now()
      );
    }, "Inserisci una data valida."),
  city: z.string().trim().max(100),
  email: z.string().trim().email("Email non valida.").or(z.literal("")),
  allergies: z.string().trim().max(2000),
  healthNotes: z.string().trim().max(2000),
  interests: z.array(z.string().trim().max(120)).max(30),
  acquisitionSource: z.enum(ACQUISITION_SOURCES).or(z.literal("")),
});

export type QuestionnaireValues = z.infer<typeof questionnaireSchema>;
