import { z } from "zod";

export const staffRoleValues = ["ADMIN", "OPERATOR"] as const;

const staffFormFields = {
  email: z.string().trim().email("Inserisci un'email valida."),
  firstName: z.string().trim().min(1, "Il nome è obbligatorio.").max(100),
  lastName: z.string().trim().min(1, "Il cognome è obbligatorio.").max(100),
  role: z.enum(staffRoleValues),
  password: z.union([
    z.literal(""),
    z.string().min(8, "La password deve contenere almeno 8 caratteri."),
  ]),
};

/** Lenient shape used by the dialog's own client-side form validation. */
export const staffFormSchema = z.object(staffFormFields);

export type StaffFormValues = z.infer<typeof staffFormSchema>;

export const staffFormDefaultValues: StaffFormValues = {
  email: "",
  firstName: "",
  lastName: "",
  role: "OPERATOR",
  password: "",
};

export const createStaffSchema = z.object(staffFormFields).refine((data) => data.password.length >= 8, {
  message: "La password è obbligatoria per un nuovo membro dello staff.",
  path: ["password"],
});

export type CreateStaffFormValues = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object(staffFormFields);

export type UpdateStaffFormValues = z.infer<typeof updateStaffSchema>;
