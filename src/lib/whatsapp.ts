import { findClientIdByPhone } from "@/lib/client-phone";
import { appointmentOperatorNames, appointmentServiceNames } from "@/lib/appointment-services";
import { normalizePhoneForWhatsapp } from "@/lib/format";
import { isFusionWaConfigured, sendTemplate, sendText } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";
import { fillTemplateBody, type TemplateVars } from "@/lib/whatsapp-shared";

export { TEMPLATE_VARIABLES } from "@/lib/whatsapp-shared";

/**
 * Logica WhatsApp di Fusion Beauty sopra il client Fusion WA: ogni invio e ogni
 * messaggio ricevuto finisce in WhatsappMessage (la chat in "Messaggi").
 * Importato anche dal worker: niente "server-only".
 */

const TIME_ZONE = "Europe/Rome";

export function appointmentVars(appointment: {
  startTime: Date;
  service: { name: string };
  /** Altri trattamenti nello stesso appuntamento: {{trattamento}} diventa "Manicure + Pedicure". */
  extraServices?: { service: { name: string }; operator?: { firstName: string } | null }[];
  operator?: { firstName: string } | null;
}): TemplateVars {
  return {
    trattamento: appointmentServiceNames(appointment),
    data: new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(appointment.startTime),
    ora: new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(appointment.startTime),
    // Operatrici diverse per i trattamenti: "Roberta e Giulia".
    operatrice: appointmentOperatorNames(appointment),
  };
}

export async function hasActiveWhatsapp(tenantId: string) {
  if (!isFusionWaConfigured()) return false;
  const connection = await prisma.whatsappConnection.findUnique({ where: { tenantId }, select: { id: true } });
  return Boolean(connection);
}

export type SendOutcome = { ok: true; messageId: string } | { ok: false; error: string; messageId?: string };

/** Testo libero: Meta lo consegna solo se la cliente ha scritto nelle ultime 24 ore. */
export async function sendWhatsappText(tenantId: string, input: { phone: string; body: string; clientId?: string | null }): Promise<SendOutcome> {
  if (!(await hasActiveWhatsapp(tenantId))) return { ok: false, error: "WhatsApp non è collegato." };
  const phone = normalizePhoneForWhatsapp(input.phone);
  const result = await sendText(tenantId, phone, input.body);
  const message = await prisma.whatsappMessage.create({
    data: {
      tenantId,
      clientId: input.clientId ?? (await findClientIdByPhone(tenantId, phone)),
      phone,
      direction: "OUTBOUND",
      status: result.ok ? "SENT" : "FAILED",
      body: input.body,
      wamid: result.ok ? result.wamid : null,
      error: result.ok ? null : result.error,
    },
  });
  return result.ok ? { ok: true, messageId: message.id } : { ok: false, error: result.error };
}

/** Template approvato: l'unico modo per scrivere per primi a una cliente. */
export async function sendWhatsappTemplate(
  tenantId: string,
  input: {
    phone: string;
    clientId?: string | null;
    templateName: string;
    language: string;
    templateBody: string;
    params: string[];
    dedupeKey?: string;
  }
): Promise<SendOutcome> {
  if (!(await hasActiveWhatsapp(tenantId))) return { ok: false, error: "WhatsApp non è collegato." };
  const phone = normalizePhoneForWhatsapp(input.phone);

  // Prima si "prenota" l'invio con la chiave univoca: due processi (es. due giri del
  // promemoria) non possono mandare lo stesso messaggio due volte.
  let messageId: string;
  try {
    const row = await prisma.whatsappMessage.create({
      data: {
        tenantId,
        clientId: input.clientId ?? (await findClientIdByPhone(tenantId, phone)),
        phone,
        direction: "OUTBOUND",
        status: "SENT",
        body: input.templateBody ? fillTemplateBody(input.templateBody, input.params) : `[Template ${input.templateName}]`,
        templateName: input.templateName,
        dedupeKey: input.dedupeKey ?? null,
      },
    });
    messageId = row.id;
  } catch (err) {
    if (input.dedupeKey && (err as { code?: string }).code === "P2002") return { ok: false, error: "Messaggio già inviato." };
    throw err;
  }

  const result = await sendTemplate(tenantId, phone, { name: input.templateName, language: input.language, bodyParams: input.params });
  await prisma.whatsappMessage.update({
    where: { id: messageId },
    data: result.ok ? { wamid: result.wamid } : { status: "FAILED", error: result.error },
  });
  return result.ok ? { ok: true, messageId } : { ok: false, error: result.error, messageId };
}

// ── Messaggi in arrivo (webhook Meta inoltrato da Fusion WA) ─────────────────

type MetaValue = {
  metadata?: { phone_number_id?: string };
  /** Storico chat dell'app WhatsApp Business (Coexistence), inviato una volta dopo il collegamento. */
  history?: {
    metadata?: { phase?: number | string; chunk_order?: number | string; progress?: number | string };
    threads?: { id?: string; messages?: { from?: string; id?: string; timestamp?: string; type?: string; history_context?: { status?: string }; [key: string]: unknown }[] }[];
  }[];
  state_sync?: {
    type?: string;
    action?: string;
    contact?: { phone_number?: string; full_name?: string; first_name?: string };
  }[];
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: { from?: string; id?: string; timestamp?: string; type?: string; [key: string]: unknown }[];
  /** Messaggi scritti dal centro nell'app WhatsApp Business sul telefono (Coexistence). */
  message_echoes?: { from?: string; to?: string; id?: string; timestamp?: string; type?: string; [key: string]: unknown }[];
  statuses?: { id?: string; status?: string; errors?: { title?: string; message?: string }[] }[];
};

export function inboundMessageText(message: { type?: string; [key: string]: unknown }): string {
  const obj = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  if (message.type === "text") return str(obj(message.text).body);
  if (message.type === "button") return str(obj(message.button).text) || "[Bottone]";
  if (message.type === "interactive") {
    const interactive = obj(message.interactive);
    const reply = obj(interactive.button_reply ?? interactive.list_reply);
    return str(reply.title) || "[Risposta]";
  }
  const labels: Record<string, string> = {
    image: "📷 Foto",
    video: "🎥 Video",
    audio: "🎤 Messaggio vocale",
    document: "📄 Documento",
    sticker: "Sticker",
    location: "📍 Posizione",
    contacts: "👤 Contatto",
    reaction: `Reazione ${str(obj(message.reaction).emoji)}`,
  };
  const caption = str(obj(message[message.type ?? ""]).caption);
  return [labels[message.type ?? ""] ?? `[Messaggio ${message.type}]`, caption].filter(Boolean).join(" · ");
}

const MEDIA_TYPES = new Set(["image", "audio", "video", "document", "sticker"]);

/** File allegato (foto, vocale…): id su Meta e tipo, per aprirlo da Messaggi. */
export function messageMedia(message: { type?: string; [key: string]: unknown }): { mediaId: string | null; mediaType: string | null } {
  if (!message.type || !MEDIA_TYPES.has(message.type)) return { mediaId: null, mediaType: null };
  const media = message[message.type] as { id?: unknown; mime_type?: unknown } | undefined;
  return {
    mediaId: typeof media?.id === "string" ? media.id : null,
    mediaType: typeof media?.mime_type === "string" ? media.mime_type : message.type,
  };
}

const STATUS_RANK = { SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4, RECEIVED: 0 } as const;

export async function ingestWebhookPayload(payload: { entry?: { changes?: { value?: MetaValue }[] }[] }) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!value || !phoneNumberId) continue;
      const connection = await prisma.whatsappConnection.findUnique({ where: { phoneNumberId } });
      if (!connection) continue;
      const tenantId = connection.tenantId;

      for (const message of value.messages ?? []) {
        if (!message.from || !message.id || message.type === "reaction") continue;
        const phone = normalizePhoneForWhatsapp(message.from);
        const createdAt = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();
        const clientId = await findClientIdByPhone(tenantId, phone);
        const known = await prisma.whatsappMessage.findUnique({ where: { wamid: message.id }, select: { id: true } });
        if (known) continue; // consegna doppia del webhook
        const body = inboundMessageText(message);
        await prisma.whatsappMessage.create({
          data: {
            tenantId,
            clientId,
            phone,
            direction: "INBOUND",
            status: "RECEIVED",
            body,
            ...messageMedia(message),
            wamid: message.id,
            createdAt,
          },
        });
        // Risposta a una proposta di orario: col pulsante (cita il messaggio) o
        // scrivendo "sì / va bene" all'ultima proposta in attesa.
        const quoted = (message.context as { id?: string } | undefined)?.id;
        const { handleProposalReply, latestPendingProposalWamid } = await import("@/lib/booking-proposals");
        const target = quoted ?? (clientId ? await latestPendingProposalWamid(tenantId, clientId) : null);
        if (target) await handleProposalReply(tenantId, target, body, Boolean(quoted));

        if (clientId) {
          // Import dinamico: il motore delle automazioni importa a sua volta questo file.
          const { stopRunsOnReply, triggerAutomations } = await import("@/lib/automation-engine");
          await stopRunsOnReply(tenantId, clientId);
          await triggerAutomations(tenantId, "WHATSAPP_RECEIVED", { clientId, triggerKey: `message:${message.id}`, filter: { message: body } });
        }
      }

      // Scritti dal telefono (app WhatsApp Business): finiscono nella chat come messaggi del centro.
      // Niente automazioni: li ha scritti una persona.
      for (const echo of value.message_echoes ?? []) {
        if (!echo.to || !echo.id || echo.type === "reaction") continue;
        const known = await prisma.whatsappMessage.findUnique({ where: { wamid: echo.id }, select: { id: true } });
        if (known) continue;
        const phone = normalizePhoneForWhatsapp(echo.to);
        await prisma.whatsappMessage.create({
          data: {
            tenantId,
            clientId: await findClientIdByPhone(tenantId, phone),
            phone,
            direction: "OUTBOUND",
            status: "SENT",
            body: inboundMessageText(echo),
            ...messageMedia(echo),
            wamid: echo.id,
            createdAt: echo.timestamp ? new Date(Number(echo.timestamp) * 1000) : new Date(),
          },
        });        // Ha risposto dal telefono: la chat è letta anche qui.
        await prisma.whatsappMessage.updateMany({ where: { tenantId, phone, direction: "INBOUND", readAt: null }, data: { readAt: new Date() } });
      }

      if (value.history?.length) {
        await importHistory(tenantId, value);
      }

      // Rubrica dell'app WhatsApp Business: le persone salvate nel telefono
      // diventano clienti (solo aggiunte, senza far partire automazioni).
      for (const item of value.state_sync ?? []) {
        if (item.type !== "contact" || item.action !== "add" || !item.contact?.phone_number) continue;
        await importAppContact(tenantId, item.contact);
      }

      for (const status of value.statuses ?? []) {
        const statusMap: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
        const next = statusMap[status.status ?? ""];
        if (!status.id || !next) continue;
        const current = await prisma.whatsappMessage.findUnique({ where: { wamid: status.id }, select: { id: true, status: true } });
        // Gli stati arrivano anche fuori ordine: non si torna da "letto" a "consegnato".
        if (!current || STATUS_RANK[current.status] >= STATUS_RANK[next]) continue;
        const error = status.errors?.[0];
        await prisma.whatsappMessage.update({
          where: { id: current.id },
          data: { status: next, ...(next === "FAILED" ? { error: error?.message ?? error?.title ?? "Messaggio non consegnato" } : {}) },
        });
      }
    }
  }
}

export const APP_CONTACT_SOURCE = "WhatsApp Business App";

/** Nome e cognome dalla rubrica: first_name è il nome, il resto di full_name il cognome. */
function splitAppName(fullName?: string, firstName?: string) {
  const full = fullName?.trim();
  const first = firstName?.trim();
  if (first && full && full.startsWith(first) && full.length > first.length) return { firstName: first, lastName: full.slice(first.length).trim() };
  return { firstName: first || full || "", lastName: "" };
}

async function importAppContact(tenantId: string, contact: { phone_number?: string; full_name?: string; first_name?: string }) {
  const digits = (contact.phone_number ?? "").replace(/\D/g, "");
  // Identificativi che non sono numeri veri (es. utenti con solo username): si ignorano.
  if (digits.length < 8 || digits.length > 15) return;
  const phone = normalizePhoneForWhatsapp(digits);
  const existing = await findClientIdByPhone(tenantId, phone);
  const names = splitAppName(contact.full_name, contact.first_name);
  if (existing) {
    // Nome segnaposto messo da un import precedente: si aggiorna con quello della rubrica.
    if (names.firstName) {
      await prisma.client.updateMany({
        where: { id: existing, acquisitionSource: APP_CONTACT_SOURCE, firstName: `+${phone}` },
        data: { firstName: names.firstName, lastName: names.lastName },
      });
    }
    return;
  }
  await prisma.client.create({
    data: {
      tenantId,
      firstName: names.firstName || `+${phone}`,
      lastName: names.lastName,
      phone: `+${phone}`,
      acquisitionSource: APP_CONTACT_SOURCE,
    },
  });
}

/**
 * Storico delle chat dell'app WhatsApp Business: Meta lo manda una sola volta
 * (entro 24 ore dal collegamento) a blocchi. Si salva grezzo, così si può
 * rielaborare, e diventa subito conversazione in Messaggi: i messaggi della
 * cliente hanno "from" uguale al thread, gli altri li ha mandati il centro.
 * Già letti, niente automazioni.
 */
async function importHistory(tenantId: string, value: MetaValue) {
  const { createHash } = await import("node:crypto");
  const contentHash = createHash("sha256").update(JSON.stringify(value.history)).digest("hex");
  try {
    await prisma.whatsappHistoryChunk.create({ data: { tenantId, contentHash, payload: JSON.parse(JSON.stringify(value.history)) } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return; // blocco già ricevuto
    throw err;
  }

  const statusMap: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    played: "READ",
    error: "FAILED",
    failed: "FAILED",
  };
  for (const chunk of value.history ?? []) {
    for (const thread of chunk.threads ?? []) {
      if (!thread.id) continue;
      const customer = normalizePhoneForWhatsapp(thread.id);
      const clientId = await findClientIdByPhone(tenantId, customer);
      for (const message of thread.messages ?? []) {
        if (!message.id || message.type === "reaction") continue;
        const inbound = message.from ? normalizePhoneForWhatsapp(message.from) === customer : true;
        const createdAt = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();
        const known = await prisma.whatsappMessage.findUnique({ where: { wamid: message.id }, select: { id: true } });
        if (known) continue;
        await prisma.whatsappMessage.create({
          data: {
            tenantId,
            clientId,
            phone: customer,
            direction: inbound ? "INBOUND" : "OUTBOUND",
            status: inbound ? "RECEIVED" : (statusMap[(message.history_context?.status ?? "").toLowerCase()] ?? "SENT"),
            body: inboundMessageText(message),
            ...messageMedia(message),
            wamid: message.id,
            readAt: inbound ? new Date() : null,
            createdAt,
          },
        });
      }
    }
  }
}
