import { z } from "zod";

/**
 * Campagne WhatsApp (come nel CRM, con i segmenti di un centro estetico al
 * posto dei tag). Condiviso tra la finestra di creazione (browser) e il server.
 */

export const SEGMENTS = ["ALL", "INACTIVE", "NEW", "BIRTHDAY_MONTH", "SERVICE", "INTEREST"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, { title: string; description: string }> = {
  ALL: { title: "Tutte le clienti", description: "Tutte le clienti con un numero di telefono." },
  INACTIVE: { title: "Non tornano da un po'", description: "Ultima visita più vecchia di N giorni." },
  NEW: { title: "Nuove clienti", description: "Entrate in scheda negli ultimi N giorni." },
  BIRTHDAY_MONTH: { title: "Compleanno nel mese", description: "Nate nel mese che scegli." },
  SERVICE: { title: "Hanno fatto un trattamento", description: "Almeno una visita completata per i trattamenti scelti." },
  INTEREST: { title: "Con un interesse", description: "Con l'interesse in scheda (es. Laser, Viso)." },
};

export const audienceSchema = z.object({
  segment: z.enum(SEGMENTS),
  days: z.number().int().min(1).max(3650).optional(),
  month: z.number().int().min(1).max(12).optional(),
  serviceIds: z.array(z.string().trim().max(60)).max(100).optional(),
  interest: z.string().trim().max(60).optional(),
  /** Esclude chi ha già un appuntamento fissato. */
  excludeUpcoming: z.boolean().default(false),
  /** Solo chi ha firmato il consenso marketing (consigliato per le promozioni). */
  marketingConsentOnly: z.boolean().default(true),
});
export type Audience = z.infer<typeof audienceSchema>;

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla campagna").max(120),
  templateName: z.string().trim().min(1, "Scegli il template da inviare").max(512),
  language: z.string().trim().min(1).max(20),
  templateBody: z.string().max(2000).default(""),
  params: z.array(z.string().max(500)).max(20).default([]),
  audience: audienceSchema,
  /** Vuoto = parte subito. */
  scheduledAt: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  batchSize: z.number().int().min(5).max(500),
  batchIntervalMinutes: z.number().int().min(1).max(1440),
});
export type CampaignInput = z.infer<typeof campaignInputSchema>;

export function audienceProblem(audience: Audience): string | null {
  if ((audience.segment === "INACTIVE" || audience.segment === "NEW") && !audience.days) return "Indica il numero di giorni.";
  if (audience.segment === "BIRTHDAY_MONTH" && !audience.month) return "Scegli il mese.";
  if (audience.segment === "SERVICE" && !audience.serviceIds?.length) return "Scegli almeno un trattamento.";
  if (audience.segment === "INTEREST" && !audience.interest) return "Scrivi l'interesse.";
  return null;
}

export function parseStoredAudience(value: unknown): Audience {
  const parsed = audienceSchema.safeParse(value);
  return parsed.success ? parsed.data : { segment: "ALL", excludeUpcoming: false, marketingConsentOnly: true };
}

export const CAMPAIGN_STATUS_LABELS = {
  DRAFT: "Bozza",
  SCHEDULED: "Programmata",
  SENDING: "In invio",
  PAUSED: "In pausa",
  COMPLETED: "Completata",
  FAILED: "Non partita",
} as const;
