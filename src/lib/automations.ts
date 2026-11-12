import { z } from "zod";

import type { AutomationTrigger } from "@/generated/prisma/browser";

/**
 * Automazioni di Fusion Beauty: come i workflow del CRM ma pensate per un
 * centro estetico. Un trigger (nuova cliente, prima dell'appuntamento,
 * compleanno…) e una lista di passi, con eventuali rami sì/no.
 * Condiviso da costruttore (browser), azioni e motore (server).
 */

// ── Passi ────────────────────────────────────────────────────────────────────

const id = z.string().trim().min(1).max(40);

const sendTemplateStep = z.object({
  id,
  type: z.literal("SEND_TEMPLATE"),
  templateName: z.string().trim().max(512).default(""),
  language: z.string().trim().max(20).default("it"),
  /** Testo del template con {{1}}…, per mostrare in chat il messaggio inviato. */
  templateBody: z.string().max(2000).default(""),
  /** Valori di {{1}}, {{2}}…: testo con variabili come {{nome}}. */
  params: z.array(z.string().max(500)).max(20).default([]),
  /** Vuoto = alla cliente; altrimenti a questo numero (es. avviso allo staff). */
  toPhone: z.string().trim().max(30).optional(),
});

const sendTextStep = z.object({
  id,
  type: z.literal("SEND_TEXT"),
  message: z.string().max(4096).default(""),
});

const waitStep = z.object({
  id,
  type: z.literal("WAIT"),
  amount: z.number().int().min(1).max(365),
  unit: z.enum(["minutes", "hours", "days"]),
});

const addNoteStep = z.object({ id, type: z.literal("ADD_NOTE"), text: z.string().max(1000).default("") });
const addInterestStep = z.object({ id, type: z.literal("ADD_INTEREST"), interest: z.string().trim().max(60).default("") });

export const CONDITION_FIELDS = [
  "HAS_FUTURE_APPOINTMENT",
  "VISITS_AT_LEAST",
  "HAS_INTEREST",
  "HAS_EMAIL",
  "MARKETING_CONSENT",
  "REPLIED",
] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const CONDITION_LABELS: Record<ConditionField, string> = {
  HAS_FUTURE_APPOINTMENT: "Ha già un appuntamento fissato",
  VISITS_AT_LEAST: "Ha fatto almeno N visite",
  HAS_INTEREST: "Ha l'interesse…",
  HAS_EMAIL: "Ha un'email in scheda",
  MARKETING_CONSENT: "Ha dato il consenso marketing",
  REPLIED: "Ha risposto su WhatsApp (da quando è entrata)",
};

const conditionSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  value: z.string().trim().max(60).optional(),
});

export type Condition = z.infer<typeof conditionSchema>;

export type AutomationStep =
  | z.infer<typeof sendTemplateStep>
  | z.infer<typeof sendTextStep>
  | z.infer<typeof waitStep>
  | z.infer<typeof addNoteStep>
  | z.infer<typeof addInterestStep>
  | { id: string; type: "CONDITION"; condition: Condition; then: AutomationStep[]; else: AutomationStep[] };

export const stepSchema: z.ZodType<AutomationStep> = z.lazy(() =>
  z.discriminatedUnion("type", [
    sendTemplateStep,
    sendTextStep,
    waitStep,
    addNoteStep,
    addInterestStep,
    z.object({
      id,
      type: z.literal("CONDITION"),
      condition: conditionSchema,
      then: z.array(stepSchema).max(30),
      else: z.array(stepSchema).max(30),
    }),
  ])
) as z.ZodType<AutomationStep>;

export type StepType = AutomationStep["type"];

export const STEP_LABELS: Record<StepType, { title: string; description: string }> = {
  SEND_TEMPLATE: { title: "Invia WhatsApp (template)", description: "Messaggio approvato da Meta: arriva sempre." },
  SEND_TEXT: { title: "Invia WhatsApp (testo libero)", description: "Arriva solo se la cliente ti ha scritto nelle ultime 24 ore." },
  WAIT: { title: "Aspetta", description: "Minuti, ore o giorni prima del passo successivo." },
  CONDITION: { title: "Se… allora / altrimenti", description: "Due strade diverse in base alla cliente." },
  ADD_NOTE: { title: "Aggiungi una nota alla scheda", description: "Resta nella scheda cliente, con la data." },
  ADD_INTEREST: { title: "Aggiungi un interesse", description: "Per ritrovarla nelle campagne (es. Laser)." },
};

// ── Trigger ──────────────────────────────────────────────────────────────────

export const TRIGGERS: AutomationTrigger[] = [
  "BOOKING_REQUESTED",
  "APPOINTMENT_CONFIRMED",
  "BEFORE_APPOINTMENT",
  "AFTER_APPOINTMENT",
  "CLIENT_CREATED",
  "FORM_SUBMITTED",
  "BIRTHDAY",
  "CLIENT_INACTIVE",
  "QUESTIONNAIRE",
  "WHATSAPP_RECEIVED",
];

export const TRIGGER_INFO: Record<AutomationTrigger, { title: string; description: string; appointmentVars: boolean }> = {
  BOOKING_REQUESTED: {
    title: "Richiesta online ricevuta",
    description: "Una cliente prenota dal widget o dall'agenda sul sito.",
    appointmentVars: true,
  },
  APPOINTMENT_CONFIRMED: {
    title: "Appuntamento confermato",
    description: "Confermi una richiesta online o crei un appuntamento in agenda.",
    appointmentVars: true,
  },
  BEFORE_APPOINTMENT: {
    title: "Prima di un appuntamento",
    description: "Un certo numero di ore prima dell'inizio (promemoria).",
    appointmentVars: true,
  },
  AFTER_APPOINTMENT: {
    title: "Dopo un trattamento",
    description: "Un certo numero di ore dopo un appuntamento completato (ringraziamento, recensione, richiamo).",
    appointmentVars: true,
  },
  CLIENT_CREATED: {
    title: "Nuova cliente",
    description: "Una cliente nuova entra in scheda (a mano, dal sito o da una prenotazione).",
    appointmentVars: false,
  },
  FORM_SUBMITTED: {
    title: "Form del sito compilato",
    description: "Qualcuno compila un form incorporato nel sito.",
    appointmentVars: false,
  },
  BIRTHDAY: {
    title: "Compleanno",
    description: "Il giorno del compleanno (serve la data di nascita in scheda).",
    appointmentVars: false,
  },
  CLIENT_INACTIVE: {
    title: "Cliente che non torna",
    description: "Nessuna visita da un certo numero di giorni e nessun appuntamento fissato.",
    appointmentVars: false,
  },
  QUESTIONNAIRE: {
    title: "Questionario nuova cliente",
    description: "Crei una cliente veloce: le arriva il link alla sua scheda da compilare.",
    appointmentVars: false,
  },
  WHATSAPP_RECEIVED: {
    title: "Messaggio WhatsApp ricevuto",
    description: "Una cliente ti scrive (anche solo con una parola chiave, es. PROMO).",
    appointmentVars: false,
  },
};

export const triggerConfigSchema = z.object({
  /** BEFORE_APPOINTMENT / AFTER_APPOINTMENT */
  hours: z.number().int().min(1).max(24 * 30).optional(),
  /** CLIENT_INACTIVE */
  days: z.number().int().min(7).max(730).optional(),
  /** FORM_SUBMITTED: vuoto = tutti i form */
  formId: z.string().trim().max(60).optional(),
  /** BEFORE/AFTER_APPOINTMENT: vuoto = tutti i trattamenti */
  serviceIds: z.array(z.string().trim().max(60)).max(100).optional(),
  /** WHATSAPP_RECEIVED: vuoto = qualsiasi messaggio */
  keyword: z.string().trim().max(60).optional(),
});
export type TriggerConfig = z.infer<typeof triggerConfigSchema>;

export const automationInputSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome all'automazione").max(120),
  trigger: z.enum(TRIGGERS as [AutomationTrigger, ...AutomationTrigger[]]),
  triggerConfig: triggerConfigSchema,
  steps: z.array(stepSchema).max(40),
  quietHours: z.boolean(),
  allowReentry: z.boolean(),
  stopOnReply: z.boolean(),
});
export type AutomationInput = z.infer<typeof automationInputSchema>;

/** Variabili utilizzabili nei messaggi, in base al trigger. */
export function variablesFor(trigger: AutomationTrigger) {
  const base = [
    { key: "nome", label: "Nome della cliente" },
    { key: "cognome", label: "Cognome" },
    { key: "telefono", label: "Telefono della cliente" },
    { key: "centro", label: "Nome del centro" },
    { key: "prenota", label: "Link per prenotare online" },
    { key: "scadenza", label: "Data fra 14 giorni (es. scadenza di un buono)" },
  ];
  const appointment = [
    { key: "trattamento", label: "Trattamento" },
    { key: "data", label: "Data appuntamento (es. martedì 12 novembre)" },
    { key: "ora", label: "Ora appuntamento (es. 15:30)" },
    { key: "operatrice", label: "Nome dell'operatrice" },
  ];
  if (TRIGGER_INFO[trigger].appointmentVars) return [...base, ...appointment];
  if (trigger === "QUESTIONNAIRE") return [...base, { key: "link", label: "Link del questionario" }];
  if (trigger === "FORM_SUBMITTED") return [...base, { key: "risposte", label: "Cosa ha scritto nel form" }];
  return base;
}

// ── Controlli ────────────────────────────────────────────────────────────────

export function walkSteps(steps: AutomationStep[], visit: (step: AutomationStep) => void) {
  for (const step of steps) {
    visit(step);
    if (step.type === "CONDITION") {
      walkSteps(step.then, visit);
      walkSteps(step.else, visit);
    }
  }
}

/** Cosa impedisce di attivarla (le bozze si salvano comunque). */
export function automationProblem(input: AutomationInput): string | null {
  if (input.steps.length === 0) return "Aggiungi almeno un passo.";
  const ids = new Set<string>();
  let problem: string | null = null;
  let sends = 0;
  walkSteps(input.steps, (step) => {
    if (problem) return;
    if (ids.has(step.id)) problem = "Due passi hanno lo stesso identificativo: ricarica la pagina.";
    ids.add(step.id);
    if (step.type === "SEND_TEMPLATE") {
      sends++;
      if (!step.templateName) problem = "Scegli il template da inviare in ogni passo “Invia WhatsApp”.";
      else if (step.params.some((p) => !p.trim())) problem = "Compila tutte le variabili del template ({{1}}, {{2}}…).";
      else if (step.toPhone !== undefined && step.toPhone.replace(/\D/g, "").length < 8) problem = "Scrivi il numero dello staff a cui mandare il messaggio.";
    }
    if (step.type === "SEND_TEXT") {
      sends++;
      if (!step.message.trim()) problem = "Scrivi il testo del messaggio.";
    }
    if (step.type === "ADD_NOTE" && !step.text.trim()) problem = "Scrivi il testo della nota.";
    if (step.type === "ADD_INTEREST" && !step.interest) problem = "Scrivi l'interesse da aggiungere.";
    if (step.type === "CONDITION" && (step.condition.field === "VISITS_AT_LEAST" || step.condition.field === "HAS_INTEREST") && !step.condition.value) {
      problem = "Completa la condizione (numero di visite o interesse).";
    }
  });
  if (problem) return problem;
  if (sends === 0 && !input.steps.some((s) => s.type === "ADD_NOTE" || s.type === "ADD_INTEREST")) return "Aggiungi almeno un'azione.";
  if ((input.trigger === "BEFORE_APPOINTMENT" || input.trigger === "AFTER_APPOINTMENT") && !input.triggerConfig.hours) {
    return "Indica quante ore prima o dopo l'appuntamento.";
  }
  if (input.trigger === "CLIENT_INACTIVE" && !input.triggerConfig.days) return "Indica dopo quanti giorni senza visite.";
  return null;
}

export function newStepId() {
  return Math.random().toString(36).slice(2, 10);
}

export function newStep(type: StepType): AutomationStep {
  const stepId = newStepId();
  switch (type) {
    case "SEND_TEMPLATE":
      return { id: stepId, type, templateName: "", language: "it", templateBody: "", params: [] };
    case "SEND_TEXT":
      return { id: stepId, type, message: "" };
    case "WAIT":
      return { id: stepId, type, amount: 1, unit: "days" };
    case "ADD_NOTE":
      return { id: stepId, type, text: "" };
    case "ADD_INTEREST":
      return { id: stepId, type, interest: "" };
    case "CONDITION":
      return { id: stepId, type, condition: { field: "HAS_FUTURE_APPOINTMENT" }, then: [], else: [] };
  }
}

// ── Modelli pronti ───────────────────────────────────────────────────────────

export type AutomationPreset = {
  key: string;
  title: string;
  description: string;
  example: string;
  /** Testo suggerito per i passi con un id diverso da "invio". */
  examples?: Record<string, string>;
  input: AutomationInput;
};

const template = (stepId: string): AutomationStep => ({ id: stepId, type: "SEND_TEMPLATE", templateName: "", language: "it", templateBody: "", params: [] });
const base = { quietHours: true, allowReentry: true, stopOnReply: false };

export const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    key: "reminder",
    title: "Promemoria appuntamento",
    description: "Il giorno prima ricorda l'appuntamento alla cliente.",
    example: "Ciao {{nome}}, ti ricordiamo l'appuntamento di domani alle {{ora}} per {{trattamento}}. Ti aspettiamo!",
    input: { ...base, name: "Promemoria del giorno prima", trigger: "BEFORE_APPOINTMENT", triggerConfig: { hours: 24 }, steps: [template("invio")] },
  },
  {
    key: "booking_confirmed",
    title: "Conferma appuntamento",
    description: "Appena confermi un appuntamento, la cliente riceve data e ora.",
    example: "Ciao {{nome}}, ti confermiamo {{trattamento}} il {{data}} alle {{ora}}. A presto da {{centro}}!",
    input: { ...base, name: "Conferma appuntamento", trigger: "APPOINTMENT_CONFIRMED", triggerConfig: {}, steps: [template("invio")] },
  },
  {
    key: "booking_request",
    title: "Richiesta online ricevuta",
    description: "Chi prenota dal sito sa subito che la richiesta è arrivata.",
    example: "Ciao {{nome}}, abbiamo ricevuto la tua richiesta per {{trattamento}} il {{data}} alle {{ora}}. Ti confermiamo a breve!",
    input: { ...base, name: "Richiesta online ricevuta", trigger: "BOOKING_REQUESTED", triggerConfig: {}, steps: [template("invio")] },
  },
  {
    key: "birthday",
    title: "Auguri di compleanno",
    description: "Gli auguri il giorno del compleanno, magari con un piccolo regalo.",
    example: "Buon compleanno {{nome}}! 🎉 Per festeggiare hai uno sconto del 10% sul prossimo trattamento. Prenota qui: {{prenota}}",
    input: { ...base, name: "Auguri di compleanno", trigger: "BIRTHDAY", triggerConfig: {}, steps: [template("invio")] },
  },
  {
    key: "after_treatment",
    title: "Dopo il trattamento",
    description: "Il giorno dopo chiede com'è andata; se dopo 30 giorni non ha prenotato, la invita a tornare.",
    example: "Ciao {{nome}}, com'è andato il trattamento di ieri? Se ti sei trovata bene, una recensione ci aiuta tanto!",
    examples: {
      grazie: "Ciao {{nome}}, com'è andato il trattamento di ieri? Se ti sei trovata bene, una recensione ci aiuta tanto!",
      richiamo: "Ciao {{nome}}, è passato un mese dall'ultimo trattamento: vuoi fissare il prossimo? Prenota qui {{prenota}}",
    },
    input: {
      ...base,
      name: "Dopo il trattamento",
      trigger: "AFTER_APPOINTMENT",
      triggerConfig: { hours: 24 },
      steps: [
        template("grazie"),
        { id: "attesa", type: "WAIT", amount: 30, unit: "days" },
        { id: "se", type: "CONDITION", condition: { field: "HAS_FUTURE_APPOINTMENT" }, then: [], else: [template("richiamo")] },
      ],
    },
  },
  {
    key: "inactive",
    title: "Ti aspettiamo",
    description: "Alle clienti che non vengono da 60 giorni manda un invito a tornare.",
    example: "Ciao {{nome}}, è un po' che non ci vediamo! Ti aspettiamo da {{centro}}: prenota qui {{prenota}}",
    input: { ...base, name: "Cliente che non torna da 60 giorni", trigger: "CLIENT_INACTIVE", triggerConfig: { days: 60 }, steps: [template("invio")] },
  },
  {
    key: "new_client",
    title: "Benvenuta nuova cliente",
    description: "Un messaggio di benvenuto a ogni nuova cliente.",
    example: "Ciao {{nome}}, benvenuta da {{centro}}! Per qualsiasi cosa scrivici qui.",
    input: { ...base, name: "Benvenuta nuova cliente", trigger: "CLIENT_CREATED", triggerConfig: {}, allowReentry: false, steps: [template("invio")] },
  },
  {
    key: "form_welcome",
    title: "Risposta a un form del sito",
    description: "Chi compila il form del sito riceve subito un messaggio con il link per prenotare.",
    example: "Ciao {{nome}}, grazie per averci scritto! Prenota quando vuoi qui: {{prenota}}",
    input: { ...base, name: "Risposta a un form del sito", trigger: "FORM_SUBMITTED", triggerConfig: {}, quietHours: false, steps: [template("invio")] },
  },
  {
    key: "questionnaire",
    title: "Questionario nuova cliente",
    description: "Quando crei una cliente veloce le arriva il link per compilare la sua scheda.",
    example: "Ciao {{nome}}, benvenuta da {{centro}}! Compila la tua scheda qui: {{link}}",
    input: { ...base, name: "Questionario nuova cliente", trigger: "QUESTIONNAIRE", triggerConfig: {}, quietHours: false, steps: [template("invio")] },
  },
];

export const EMPTY_AUTOMATION: AutomationInput = {
  ...base,
  name: "Nuova automazione",
  trigger: "CLIENT_CREATED",
  triggerConfig: {},
  steps: [],
};

/** Automazione salvata (JSON nel DB) sempre valida per l'interfaccia. */
export function parseStoredSteps(value: unknown): AutomationStep[] {
  const parsed = z.array(stepSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function parseStoredTriggerConfig(value: unknown): TriggerConfig {
  const parsed = triggerConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

/** Testo suggerito per un passo "Invia WhatsApp" di un'automazione nata da un modello. */
export function suggestedTextFor(presetKey: string | null | undefined, stepId: string): string | undefined {
  const preset = AUTOMATION_PRESETS.find((p) => p.key === presetKey);
  if (!preset) return undefined;
  return preset.examples?.[stepId] ?? (stepId === "invio" ? preset.example : undefined);
}

/** Tipo di template da chiedere a Meta per il trigger (conferme e promemoria = servizio). */
export function templateCategoryFor(trigger: AutomationTrigger): "UTILITY" | "MARKETING" {
  return ["BOOKING_REQUESTED", "APPOINTMENT_CONFIRMED", "BEFORE_APPOINTMENT", "QUESTIONNAIRE"].includes(trigger) ? "UTILITY" : "MARKETING";
}
