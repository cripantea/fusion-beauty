import { z } from "zod";

/**
 * Form incorporabili nei siti (come i form del CRM, in versione centro estetico):
 * ogni campo può scrivere su un dato della scheda cliente; gli altri restano
 * nella risposta. Condiviso da costruttore (client), script embed e route di invio.
 */

export const FIELD_TYPES = ["text", "email", "tel", "textarea", "select", "radio", "checkbox", "date", "number", "content"] as const;
export type FormFieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Testo",
  email: "Email",
  tel: "Telefono",
  textarea: "Testo lungo",
  select: "Menu a tendina",
  radio: "Scelta singola",
  checkbox: "Casella di spunta",
  date: "Data",
  number: "Numero",
  content: "Testo informativo",
};

/** Dato della scheda cliente su cui scrive il campo. */
export const CLIENT_FIELDS = ["firstName", "lastName", "fullName", "phone", "email", "dateOfBirth", "city", "interests", "notes"] as const;
export type ClientFieldKey = (typeof CLIENT_FIELDS)[number];

export const CLIENT_FIELD_LABELS: Record<ClientFieldKey, string> = {
  firstName: "Nome",
  lastName: "Cognome",
  fullName: "Nome e cognome",
  phone: "Telefono",
  email: "Email",
  dateOfBirth: "Data di nascita",
  city: "Città",
  interests: "Interessi",
  notes: "Note",
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Gli URL finiscono in window.location / href sulla pagina che ospita il form. */
const safeUrl = z
  .string()
  .trim()
  .default("")
  .refine((value) => {
    if (!value) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Deve essere un indirizzo che inizia con https://");

export const formFieldSchema = z.object({
  key: z.string().trim().regex(/^[a-zA-Z0-9_]{1,40}$/, "Chiave non valida"),
  label: z.string().trim().min(1, "Ogni campo deve avere un'etichetta").max(200),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  clientField: z.enum(CLIENT_FIELDS).nullable(),
  placeholder: z.string().max(200).optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  content: z.string().max(3000).optional(),
  half: z.boolean().optional(),
});
export type FormFieldDef = z.infer<typeof formFieldSchema>;

export const formSettingsSchema = z.object({
  successMessage: z.string().trim().min(1, "Scrivi il messaggio di ringraziamento").max(500),
  redirectUrl: safeUrl,
  submitButtonText: z.string().trim().min(1).max(60),
  requirePrivacyConsent: z.boolean(),
  privacyText: z.string().trim().max(500),
  privacyPolicyUrl: safeUrl,
  formBg: z.string().trim().refine((v) => HEX_COLOR.test(v), "Colore non valido"),
  textColor: z.string().trim().refine((v) => HEX_COLOR.test(v), "Colore non valido"),
  radius: z.number().int().min(0).max(30),
});
export type FormSettings = z.infer<typeof formSettingsSchema>;

export const formInputSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome al form").max(120),
  title: z.string().trim().max(200),
  fields: z.array(formFieldSchema).min(1).max(40),
  settings: formSettingsSchema,
  displayMode: z.enum(["INLINE", "POPUP"]),
  color: z.string().trim().refine((v) => HEX_COLOR.test(v), "Colore non valido"),
  welcomeMessage: z.string().trim().max(500),
  enabled: z.boolean(),
});
export type FormInput = z.infer<typeof formInputSchema>;

/** Controlli che lo schema da solo non copre. */
export function formProblem(input: FormInput): string | null {
  const keys = new Set<string>();
  for (const field of input.fields) {
    if (keys.has(field.key)) return `Due campi hanno la stessa chiave "${field.key}".`;
    keys.add(field.key);
    if ((field.type === "select" || field.type === "radio") && !field.options?.length) {
      return `Il campo "${field.label}" non ha opzioni.`;
    }
    if (field.type === "content" && !field.content?.trim()) return `Il testo informativo "${field.label}" è vuoto.`;
  }
  const mapped = new Set(input.fields.map((f) => f.clientField).filter(Boolean));
  if (!mapped.has("phone")) {
    return "Serve un campo collegato al Telefono: è il dato che identifica la cliente (e serve per WhatsApp).";
  }
  if (!mapped.has("firstName") && !mapped.has("fullName")) {
    return "Serve un campo collegato a Nome o a Nome e cognome.";
  }
  return null;
}

export const DEFAULT_SETTINGS: FormSettings = {
  successMessage: "Grazie! Ti ricontatteremo al più presto.",
  redirectUrl: "",
  submitButtonText: "Invia",
  requirePrivacyConsent: true,
  privacyText: "Ho letto l'informativa e acconsento al trattamento dei miei dati per essere ricontattata.",
  privacyPolicyUrl: "",
  formBg: "#ffffff",
  textColor: "#1f2937",
  radius: 10,
};

export const DEFAULT_FIELDS: FormFieldDef[] = [
  { key: "nome", label: "Nome e cognome", type: "text", required: true, clientField: "fullName", placeholder: "Nome e cognome" },
  { key: "telefono", label: "Cellulare", type: "tel", required: true, clientField: "phone", placeholder: "Cellulare" },
  { key: "email", label: "Email", type: "email", required: false, clientField: "email", placeholder: "Email" },
  { key: "messaggio", label: "Come possiamo aiutarti?", type: "textarea", required: false, clientField: "notes" },
];

export const DEFAULT_FORM: FormInput = {
  name: "Contatto dal sito",
  title: "Richiedi informazioni",
  fields: DEFAULT_FIELDS,
  settings: DEFAULT_SETTINGS,
  displayMode: "INLINE",
  color: "#1f3d36",
  welcomeMessage: "Ciao! Lasciaci i tuoi dati e ti ricontattiamo noi.",
  enabled: true,
};

/** Modelli pronti per il costruttore. */
export const FORM_PRESETS: { id: string; name: string; description: string; form: Partial<FormInput> }[] = [
  {
    id: "contatto",
    name: "Contatto",
    description: "Nome, telefono, email e messaggio",
    form: {},
  },
  {
    id: "primo-trattamento",
    name: "Prima visita / promo",
    description: "Raccoglie chi vuole provare un trattamento",
    form: {
      name: "Promo primo trattamento",
      title: "Prenota la tua prima consulenza",
      fields: [
        { key: "nome", label: "Nome", type: "text", required: true, clientField: "firstName", placeholder: "Nome", half: true },
        { key: "cognome", label: "Cognome", type: "text", required: false, clientField: "lastName", placeholder: "Cognome", half: true },
        { key: "telefono", label: "Cellulare", type: "tel", required: true, clientField: "phone", placeholder: "Cellulare" },
        {
          key: "interesse",
          label: "Cosa ti interessa?",
          type: "select",
          required: false,
          clientField: "interests",
          options: ["Viso", "Corpo", "Epilazione", "Mani e piedi", "Massaggi"],
        },
      ],
      settings: { ...DEFAULT_SETTINGS, submitButtonText: "Voglio essere ricontattata" },
    },
  },
  {
    id: "lista-attesa",
    name: "Lista d'attesa",
    description: "Per chi vuole sapere quando si libera un posto",
    form: {
      name: "Lista d'attesa",
      title: "Avvisami quando si libera un posto",
      fields: [
        { key: "nome", label: "Nome e cognome", type: "text", required: true, clientField: "fullName", placeholder: "Nome e cognome" },
        { key: "telefono", label: "Cellulare", type: "tel", required: true, clientField: "phone", placeholder: "Cellulare" },
        { key: "giorni", label: "Quando preferisci?", type: "radio", required: false, clientField: null, options: ["Mattina", "Pomeriggio", "Sabato"] },
      ],
      settings: { ...DEFAULT_SETTINGS, submitButtonText: "Mettimi in lista" },
    },
  },
];

/** Prende un form salvato (JSON nel DB) e lo rende sempre valido per l'interfaccia. */
export function parseStoredForm(form: { fields: unknown; settings: unknown }): { fields: FormFieldDef[]; settings: FormSettings } {
  const fields = z.array(formFieldSchema).safeParse(form.fields);
  const settings = formSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(form.settings as object) });
  return { fields: fields.success ? fields.data : DEFAULT_FIELDS, settings: settings.success ? settings.data : DEFAULT_SETTINGS };
}
