// Form del sito de La Boutique del Benessere, rifatti in Fusion Beauty uguali a
// quelli del CRM ("Sito – Ottieni un preventivo gratuito", stesso CSS).
// Id fisso: il codice incollato nel sito non cambia se lo script si rilancia.
// Gira a ogni deploy: se il form c'è già non lo tocca (le modifiche fatte dalla
// dashboard restano); con --force lo riporta com'era nel CRM.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { formInputSchema, formProblem, type FormInput } from "../src/lib/forms";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE_URL = (process.env.APP_BASE_URL ?? "https://beauty.fusionsoft.it").replace(/\/$/, "");
const SITE = "https://boutiquedelbenesserevigevano.it";

export const BOUTIQUE_QUOTE_FORM_ID = "boutique-preventivo";

// CSS del form del CRM, copiato com'è: le classi .fc-* sono le stesse.
const QUOTE_CSS =
  ".fc-card{box-sizing:border-box!important;width:100%!important;max-width:700px!important;margin:0 auto!important;padding:1px 41px 1px!important;border:1px solid #FFFFFF!important;border-radius:3px!important;box-shadow:0 4px 4px 0 rgba(87,100,126,.21)!important;background:#D5F6E8!important}form{gap:16px!important}.fc-image{display:block!important;width:100px!important;height:100px!important;margin:0 auto 2px!important}.fc-text{font-family:'Inter',sans-serif!important;font-size:28px!important;font-weight:900!important;line-height:42px!important;color:#000000!important;margin:0 0 2px!important}.fc-field{margin-bottom:2px!important}label{font-family:'Inter',sans-serif!important;font-size:14px!important;font-weight:500!important;line-height:25.2px!important;color:#2C3345!important;margin:0 0 8px!important}input[type=text],input[type=tel]{box-sizing:border-box!important;font-family:'Inter',sans-serif!important;font-size:12px!important;font-weight:300!important;line-height:18px!important;height:36px!important;padding:8px 15px!important;border:1px solid #ACACAC!important;border-radius:5px!important;background:#FFFFFF!important;color:#2C3345!important}::placeholder{color:#8C8C8C!important;opacity:1!important}.fc-privacy{margin:0!important;gap:20px!important;align-items:flex-start!important;font-family:'Inter',sans-serif!important;font-size:14px!important;font-weight:500!important;line-height:20px!important;color:#2C3345!important;hyphens:auto;-webkit-hyphens:auto}.fc-privacy span{font:inherit!important;color:inherit!important}.fc-privacy input{flex:0 0 15px!important;width:15px!important;height:15px!important;margin:3px 0 0 0!important}button.fc-submit{margin-top:25px!important;background:#155EEF!important;color:#FFFFFF!important;font-family:'Inter',sans-serif!important;font-size:14px!important;font-weight:500!important;line-height:25.2px!important;padding:12px 20px!important;width:100%!important;border-radius:8px!important;box-shadow:0 1px 2px 0 rgba(0,0,0,.08)!important;letter-spacing:normal!important}.fc-links{margin:33px 0 16px!important;font-family:'Inter',sans-serif!important;font-size:14px!important;font-weight:400!important;line-height:21px!important;color:#000000!important;text-align:center!important}.fc-links a{color:#000000!important;text-decoration:underline!important;font:inherit!important}@media (max-width:499.98px){.fc-card{padding:61px 41px 31px!important}.fc-text{font-family:'Roboto',sans-serif!important}label{font-family:'Roboto',sans-serif!important;font-weight:400!important;color:#000000!important}.fc-privacy{font-family:'Roboto',sans-serif!important;font-weight:400!important;color:#000000!important}::placeholder{font-family:'Roboto',sans-serif!important;font-size:14px!important;color:#AFB8BC!important}.fc-links{font-family:'Roboto',sans-serif!important}}";

const QUOTE_FORM: FormInput = {
  name: "Sito – Ottieni un preventivo gratuito",
  title: "",
  displayMode: "INLINE",
  color: "#155EEF",
  welcomeMessage: "",
  enabled: true,
  fields: [
    {
      key: "logo",
      label: "Logo",
      type: "image",
      required: false,
      clientField: null,
      imageUrl: `${BASE_URL}/forms/boutique-form-logo.jpg`,
      imageAlt: "La Boutique del Benessere",
      imageWidth: 20,
      imageAlign: "center",
    },
    {
      key: "titolo",
      label: "Titolo",
      type: "content",
      required: false,
      clientField: null,
      content: "OTTIENI UN PREVENTIVO GRATUITO",
      textSize: 28,
      textBold: true,
      textAlign: "center",
      textColor: "#000000",
    },
    { key: "firstName", label: "First Name", type: "text", required: true, clientField: "firstName", placeholder: "First Name" },
    { key: "phone", label: "Phone", type: "tel", required: true, clientField: "phone", placeholder: "Phone" },
    // Finisce nelle note della scheda cliente, con nome del form e data
    { key: "richiesta", label: "Inserisci una breve richiesta", type: "text", required: true, clientField: "notes" },
  ],
  settings: {
    successMessage: "Grazie! Abbiamo ricevuto la tua richiesta, ti ricontatteremo al più presto.",
    redirectUrl: "",
    submitButtonText: "Invia la tua richiesta",
    requirePrivacyConsent: true,
    privacyText: "Inviando il modulo accetti di ricevere SMS o WhatsApp tramite il canale indicato.",
    privacyPolicyUrl: `${SITE}/home-564243-295216`,
    privacyLinkText: "Privacy Policy",
    termsUrl: `${SITE}/home-564243-295216-344492`,
    termsLinkText: "Terms of Service",
    formBg: "#D5F6E8",
    textColor: "#2C3345",
    radius: 5,
    fieldBg: "#FFFFFF",
    fieldTextColor: "#2C3345",
    fieldBorderColor: "#ACACAC",
    fieldBorderWidth: 1,
    placeholderColor: "#8C8C8C",
    labelColor: "#2C3345",
    smallTextColor: "#2C3345",
    formBorderColor: "#FFFFFF",
    formBorderWidth: 1,
    formBorderRadius: 3,
    formShadow: "soft",
    formPadding: 40,
    formMaxWidth: 700,
    fieldGap: 16,
    buttonTextColor: "#FFFFFF",
    buttonRadius: 8,
    fontFamily: "Inter",
    customCss: QUOTE_CSS,
  },
};

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "boutique-del-benessere" }, select: { id: true } });
  // Su un database senza la Boutique (es. un altro server) non è un errore: non fa nulla.
  if (!tenant) {
    console.log("Centro boutique-del-benessere non presente: nessun form da creare.");
    return;
  }

  const existing = await prisma.form.findUnique({ where: { id: BOUTIQUE_QUOTE_FORM_ID }, select: { id: true } });
  if (existing && !process.argv.includes("--force")) {
    console.log(`Form "${BOUTIQUE_QUOTE_FORM_ID}" già presente: non lo tocco (usa --force per riscriverlo).`);
    return;
  }

  const form = formInputSchema.parse(QUOTE_FORM);
  const problem = formProblem(form);
  if (problem) throw new Error(problem);

  const data = {
    name: form.name,
    title: form.title,
    fields: form.fields as Prisma.InputJsonValue,
    settings: form.settings as Prisma.InputJsonValue,
    displayMode: form.displayMode,
    color: form.color,
    welcomeMessage: form.welcomeMessage,
    enabled: form.enabled,
  };
  await prisma.form.upsert({
    where: { id: BOUTIQUE_QUOTE_FORM_ID },
    update: data,
    create: { id: BOUTIQUE_QUOTE_FORM_ID, tenantId: tenant.id, ...data },
  });

  console.log(`✅ Form "${form.name}" pronto. Codice per il sito:`);
  console.log(`<div id="fusion-beauty-form-${BOUTIQUE_QUOTE_FORM_ID}"></div>`);
  console.log(`<script src="${BASE_URL}/api/embed/form/${BOUTIQUE_QUOTE_FORM_ID}" async></script>`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
