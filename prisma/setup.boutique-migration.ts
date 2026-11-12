// Migrazione da GoHighLevel de La Boutique del Benessere: le automazioni del
// subaccount GHL rifatte in Fusion Beauty (i template omonimi sono stati
// ricreati sul numero collegato con Fusion WA e sono in revisione da Meta).
// Gira a ogni deploy ma crea solo ciò che manca (presetKey "ghl:<nome>"):
// le modifiche fatte dalla dashboard restano. Le automazioni nascono in pausa:
// si attivano da Automazioni quando Meta ha approvato i template.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { DEFAULT_SETTINGS, formInputSchema, type FormInput } from "../src/lib/forms";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SITE = "https://boutiquedelbenesserevigevano.it";
const QUOTE_FORM_ID = "boutique-preventivo";
const REVIEW_FORM_ID = "boutique-recensione";

// Form "Marketing – Invia richiesta recensione" di GHL (pagina /marketing del sito):
// lo staff inserisce nome e telefono della cliente e parte la richiesta di recensione.
const REVIEW_FORM: FormInput = {
  name: "Marketing – Invia richiesta recensione",
  title: "Invia richiesta recensione",
  displayMode: "INLINE",
  color: "#0062FF",
  welcomeMessage: "",
  enabled: true,
  fields: [
    { key: "firstName", label: "Nome cliente", type: "text", required: true, clientField: "firstName", placeholder: "NOME CLIENTE" },
    { key: "phone", label: "Telefono", type: "tel", required: true, clientField: "phone", placeholder: "Telefono*" },
  ],
  settings: {
    ...DEFAULT_SETTINGS,
    successMessage: "Richiesta di recensione inviata.",
    submitButtonText: "INVIA RICHIESTA RECENSIONE",
    requirePrivacyConsent: false,
    privacyPolicyUrl: `${SITE}/home-564243-295216`,
    termsUrl: `${SITE}/home-564243-295216-344492`,
    formBg: "#ffffff",
    textColor: "#000000",
    radius: 30,
    fieldBg: "#534F8F",
    fieldTextColor: "#FFFFFF",
    fieldBorderWidth: 0,
    placeholderColor: "#AFB8BC",
    hideLabels: true,
    formBorderColor: "#3F3B7B",
    formBorderWidth: 2,
    formBorderRadius: 25,
    formMaxWidth: 548,
    fieldGap: 20,
    fontFamily: "Roboto",
  },
};

const template = (templateName: string, templateBody: string, params: string[]) => ({
  id: "invio",
  type: "SEND_TEMPLATE" as const,
  templateName,
  language: "it",
  templateBody,
  params,
});

const AUTOMATIONS: {
  key: string;
  name: string;
  trigger: "FORM_SUBMITTED" | "WHATSAPP_RECEIVED" | "BIRTHDAY" | "BEFORE_APPOINTMENT";
  triggerConfig: Record<string, unknown>;
  steps: unknown[];
  quietHours: boolean;
  allowReentry: boolean;
}[] = [
  {
    key: "ghl:form-sito-web",
    name: "Form sito – richiesta ricevuta (da GHL)",
    trigger: "FORM_SUBMITTED",
    triggerConfig: { formId: QUOTE_FORM_ID },
    steps: [
      template(
        "speed_to_lead",
        "Ciao {{1}}! Abbiamo ricevuto la tua richiesta. Ti ricontatteremo al più presto per confermare il trattamento e darti tutte le informazioni.",
        ["{{nome}}"]
      ),
    ],
    quietHours: false,
    allowReentry: true,
  },
  {
    key: "ghl:send-review",
    name: "Richiesta recensione (da GHL)",
    trigger: "FORM_SUBMITTED",
    triggerConfig: { formId: REVIEW_FORM_ID },
    steps: [
      template(
        "recensione_a",
        "Ciao {{1}} 😊 Speriamo che la tua esperienza da noi sia stata piacevole. Se ti fa piacere, puoi lasciarci una recensione qui: https://g.page/r/CY_sL-BiyPcdEBM/review Mandaci lo screenshot e avrai 5€ di sconto sul prossimo trattamento. Grazie davvero 🩵",
        ["{{nome}}"]
      ),
    ],
    quietHours: false,
    allowReentry: true,
  },
  {
    key: "boutique:avviso-staff",
    name: "Avviso allo staff: nuova richiesta dal sito",
    trigger: "FORM_SUBMITTED",
    triggerConfig: { formId: QUOTE_FORM_ID },
    steps: [
      {
        ...template(
          "avviso_robi",
          "Ciao Robi! hai ricevuto una nuova richiesta! Ti ha scritto :{{1}} Numero: {{2}} Richiesta: {{3}} Contattalo al più presto per non farlo andare da un altra parte!",
          ["{{nome}} {{cognome}}", "{{telefono}}", "{{risposte}}"]
        ),
        // Numero dello staff da scrivere in Automazioni prima di attivarla.
        toPhone: "",
      },
    ],
    quietHours: false,
    allowReentry: true,
  },
  {
    key: "boutique:compleanno",
    name: "Auguri di compleanno con buono 10€",
    trigger: "BIRTHDAY",
    triggerConfig: {},
    steps: [
      template(
        "auguri_compleanno",
        "Buon compleanno {{1}}! 🎉 Per festeggiarti ti regaliamo un buono da 10€ su un trattamento a tua scelta, valido fino al {{2}}. Mostra questo messaggio in cassa e prenota scrivendoci al 351 857 1506 o chiamandoci. Un abbraccio da La Boutique del Benessere 🩵",
        ["{{nome}}", "{{scadenza}}"]
      ),
    ],
    quietHours: true,
    allowReentry: true,
  },
  {
    key: "boutique:promemoria-24h",
    name: "Promemoria appuntamento 24 ore prima",
    trigger: "BEFORE_APPOINTMENT",
    triggerConfig: { hours: 24 },
    steps: [
      template(
        "promemoria_appuntamento",
        "Ciao {{1}}, ti ricordiamo il tuo appuntamento di {{2}} alle {{3}} per {{4}} da La Boutique del Benessere. Se hai un imprevisto scrivici qui per spostarlo. A presto!",
        ["{{nome}}", "{{data}}", "{{ora}}", "{{trattamento}}"]
      ),
    ],
    quietHours: true,
    allowReentry: true,
  },
  {
    key: "ghl:risposta-auto",
    name: "Risposta automatica WhatsApp (da GHL)",
    trigger: "WHATSAPP_RECEIVED",
    triggerConfig: {},
    steps: [
      template(
        "ai_generated_template_1765226577653",
        "Per parlare con Roberta e Giulia , scrivi al numero qui sotto indicato o chiama qua. Purtroppo non possiamo vedere, è un messaggio automatico.",
        []
      ),
    ],
    quietHours: false,
    allowReentry: true,
  },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "boutique-del-benessere" }, select: { id: true, logoUrl: true } });
  if (!tenant) {
    console.log("Centro boutique-del-benessere non presente: niente da migrare.");
    return;
  }

  // Logo nell'agenda di prenotazione (al posto dell'iniziale), se non c'è già.
  if (!tenant.logoUrl) {
    const base = (process.env.APP_BASE_URL ?? "https://beauty.fusionsoft.it").replace(/\/$/, "");
    await prisma.tenant.update({ where: { id: tenant.id }, data: { logoUrl: `${base}/forms/boutique-form-logo.jpg` } });
    console.log("✅ Logo della Boutique impostato.");
  }

  const reviewForm = await prisma.form.findUnique({ where: { id: REVIEW_FORM_ID }, select: { id: true } });
  if (!reviewForm) {
    const form = formInputSchema.parse(REVIEW_FORM);
    await prisma.form.create({
      data: {
        id: REVIEW_FORM_ID,
        tenantId: tenant.id,
        name: form.name,
        title: form.title,
        fields: form.fields as Prisma.InputJsonValue,
        settings: form.settings as Prisma.InputJsonValue,
        displayMode: form.displayMode,
        color: form.color,
        welcomeMessage: form.welcomeMessage,
        enabled: form.enabled,
      },
    });
    console.log(`✅ Form "${form.name}" creato.`);
  }

  for (const automation of AUTOMATIONS) {
    const existing = await prisma.automation.findFirst({ where: { tenantId: tenant.id, presetKey: automation.key }, select: { id: true } });
    if (existing) continue;
    await prisma.automation.create({
      data: {
        tenantId: tenant.id,
        name: automation.name,
        status: "PAUSED",
        trigger: automation.trigger,
        triggerConfig: automation.triggerConfig as Prisma.InputJsonValue,
        steps: automation.steps as Prisma.InputJsonValue,
        quietHours: automation.quietHours,
        allowReentry: automation.allowReentry,
        presetKey: automation.key,
      },
    });
    console.log(`✅ Automazione "${automation.name}" creata (in pausa).`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
