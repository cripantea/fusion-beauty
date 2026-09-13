import { z } from "zod";

export const roleValues = ["SUPER_ADMIN", "ADMIN", "OPERATOR"] as const;

const userFormFields = {
  email: z.string().trim().email("Inserisci un'email valida."),
  firstName: z.string().trim().min(1, "Il nome è obbligatorio.").max(100),
  lastName: z.string().trim().min(1, "Il cognome è obbligatorio.").max(100),
  role: z.enum(roleValues),
  tenantId: z.string().nullable(),
  password: z.union([
    z.literal(""),
    z.string().min(8, "La password deve contenere almeno 8 caratteri."),
  ]),
};

function requiresTenant(data: { role: (typeof roleValues)[number]; tenantId: string | null }) {
  return data.role === "SUPER_ADMIN" || data.tenantId !== null;
}

const requiresTenantIssue = {
  message: "Seleziona il centro di appartenenza.",
  path: ["tenantId"] as string[],
};

/** Lenient shape used by the dialog's own client-side form validation. */
export const userFormSchema = z.object(userFormFields).refine(requiresTenant, requiresTenantIssue);

export type UserFormValues = z.infer<typeof userFormSchema>;

export const userFormDefaultValues: UserFormValues = {
  email: "",
  firstName: "",
  lastName: "",
  role: "OPERATOR",
  tenantId: null,
  password: "",
};

export const createUserSchema = z
  .object(userFormFields)
  .refine(requiresTenant, requiresTenantIssue)
  .refine((data) => data.password.length >= 8, {
    message: "La password è obbligatoria per un nuovo utente.",
    path: ["password"],
  });

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object(userFormFields).refine(requiresTenant, requiresTenantIssue);

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
