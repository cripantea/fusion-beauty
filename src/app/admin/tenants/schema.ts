import { z } from "zod";

export const createTenantSchema = z.object({
  tenantName: z.string().trim().min(1, "Il nome del centro è obbligatorio.").max(200),
  tenantSlug: z
    .string()
    .trim()
    .min(1, "Lo slug è obbligatorio.")
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Usa solo lettere minuscole, numeri e trattini."),
  adminEmail: z.string().trim().email("Inserisci un'email valida."),
  adminFirstName: z.string().trim().min(1, "Il nome è obbligatorio.").max(100),
  adminLastName: z.string().trim().min(1, "Il cognome è obbligatorio.").max(100),
  adminPassword: z.string().min(8, "La password deve contenere almeno 8 caratteri."),
});

export type CreateTenantFormValues = z.infer<typeof createTenantSchema>;

export const createTenantDefaultValues: CreateTenantFormValues = {
  tenantName: "",
  tenantSlug: "",
  adminEmail: "",
  adminFirstName: "",
  adminLastName: "",
  adminPassword: "",
};
