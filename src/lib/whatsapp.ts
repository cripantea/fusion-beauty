import type { WhatsappAutomationKind } from "@/generated/prisma/client";
import { findClientIdByPhone } from "@/lib/client-phone";
import { normalizePhoneForWhatsapp } from "@/lib/format";
import { isFusionWaConfigured, sendTemplate, sendText } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";
import { fillTemplateBody, renderVariables, type TemplateVars } from "@/lib/whatsapp-shared";

export { AUTOMATION_INFO, AUTOMATION_KINDS, TEMPLATE_VARIABLES } from "@/lib/whatsapp-shared";

/**
 * Logica WhatsApp di Fusion Beauty sopra il client Fusion WA: ogni invio e ogni
 * messaggio ricevuto finisce in WhatsappMessage (la chat in "Messaggi").
 * Importato anche dal worker: niente "server-only".
 */

const TIME_ZONE = "Europe/Rome";

export function appointmentVars(appointment: { startTime: Date; service: { name: string }; operator?: { firstName: string } | null }): TemplateVars {
  return {
    trattamento: appointment.service.name,
    data: new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(appointment.startTime),
    ora: new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(appointment.startTime),
    operatrice: appointment.operator?.firstName ?? "",
  };
}

function bookingUrl(slug: string) {
  const base = (process.env.APP_BASE_URL ?? "https://beauty.fusionsoft.it").replace(/\/$/, "");
  return `${base}/embed/${slug}`;
}

export async function hasActiveWhatsapp(tenantId: string) {
  if (!isFusionWaConfigured()) return false;
  const connection = await prisma.whatsappConnection.findUnique({ where: { tenantId }, select: { id: true } });
  return Boolean(connection);
}

export type SendOutcome = { ok: true; messageId: string } | { ok: false; error: string };

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
  return result.ok ? { ok: true, messageId } : { ok: false, error: result.error };
}

/**
 * Invia il messaggio automatico `kind` se il centro l'ha attivato. Non lancia mai:
 * un problema con WhatsApp non deve far fallire la prenotazione o il form.
 */
export async function runAutomation(
  tenantId: string,
  kind: WhatsappAutomationKind,
  ctx: { client: { id: string; firstName: string; lastName: string; phone: string }; vars?: TemplateVars; dedupeKey?: string }
): Promise<SendOutcome | null> {
  try {
    const automation = await prisma.whatsappAutomation.findUnique({ where: { tenantId_kind: { tenantId, kind } } });
    if (!automation?.enabled || !automation.templateName) return null;
    if (!(await hasActiveWhatsapp(tenantId))) return null;

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, slug: true } });
    const vars: TemplateVars = {
      nome: ctx.client.firstName,
      cognome: ctx.client.lastName,
      centro: tenant.name,
      prenota: bookingUrl(tenant.slug),
      ...ctx.vars,
    };
    // Meta rifiuta i parametri vuoti: al loro posto un trattino.
    const params = automation.params.map((p) => renderVariables(p, vars).trim() || "-");

    return await sendWhatsappTemplate(tenantId, {
      phone: ctx.client.phone,
      clientId: ctx.client.id,
      templateName: automation.templateName,
      language: automation.language,
      templateBody: automation.templateBody,
      params,
      dedupeKey: ctx.dedupeKey ?? `${kind.toLowerCase()}:${ctx.client.id}:${Date.now()}`,
    });
  } catch (err) {
    console.error(`[whatsapp] automazione ${kind} non inviata:`, err);
    return { ok: false, error: "Invio non riuscito." };
  }
}

/** Automazioni legate a un appuntamento (richiesta online, conferma). */
export async function runAppointmentAutomation(kind: "BOOKING_REQUEST" | "BOOKING_CONFIRMED", appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: true, service: true, operator: { select: { firstName: true } } },
  });
  if (!appointment) return null;
  return runAutomation(appointment.tenantId, kind, {
    client: appointment.client,
    vars: appointmentVars(appointment),
    // Una conferma per appuntamento e orario: se lo sposti, parte la nuova conferma.
    dedupeKey: `${kind.toLowerCase()}:${appointment.id}:${appointment.startTime.toISOString()}`,
  });
}

// ── Messaggi in arrivo (webhook Meta inoltrato da Fusion WA) ─────────────────

type MetaValue = {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: { from?: string; id?: string; timestamp?: string; type?: string; [key: string]: unknown }[];
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
        await prisma.whatsappMessage.upsert({
          where: { wamid: message.id },
          update: {},
          create: {
            tenantId,
            clientId: await findClientIdByPhone(tenantId, phone),
            phone,
            direction: "INBOUND",
            status: "RECEIVED",
            body: inboundMessageText(message),
            wamid: message.id,
            createdAt,
          },
        });
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

// ── Promemoria e compleanni (worker, ogni 15 minuti) ─────────────────────────

function romeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

/** Inizio del giorno (ora di Roma) `offsetDays` giorni dopo oggi, come istante UTC. */
function romeDayStart(now: Date, offsetDays: number): Date {
  const { year, month, day } = romeParts(now);
  const guess = new Date(Date.UTC(year, month - 1, day + offsetDays, 0, 0));
  // Correzione del fuso (CET/CEST): mezzanotte di Roma = 22:00 o 23:00 UTC del giorno prima.
  const offsetHours = romeParts(guess).hour;
  return new Date(guess.getTime() - (offsetHours >= 12 ? offsetHours - 24 : offsetHours) * 3600_000);
}

export async function runScheduledAutomations(now = new Date()) {
  const automations = await prisma.whatsappAutomation.findMany({
    where: { enabled: true, kind: { in: ["REMINDER", "BIRTHDAY"] }, tenant: { isActive: true, whatsappConnection: { isNot: null } } },
    select: { tenantId: true, kind: true },
  });
  if (!isFusionWaConfigured() || automations.length === 0) return;
  const { hour, month, day, year } = romeParts(now);

  for (const automation of automations) {
    if (automation.kind === "REMINDER" && hour >= 10 && hour < 21) {
      const appointments = await prisma.appointment.findMany({
        where: {
          tenantId: automation.tenantId,
          status: { in: ["BOOKED", "CONFIRMED"] },
          startTime: { gte: romeDayStart(now, 1), lt: romeDayStart(now, 2) },
        },
        include: { client: true, service: true, operator: { select: { firstName: true } } },
      });
      for (const appointment of appointments) {
        await runAutomation(automation.tenantId, "REMINDER", {
          client: appointment.client,
          vars: appointmentVars(appointment),
          dedupeKey: `reminder:${appointment.id}:${appointment.startTime.toISOString()}`,
        });
      }
    }

    if (automation.kind === "BIRTHDAY" && hour >= 9 && hour < 20) {
      const clients = await prisma.$queryRaw<{ id: string; firstName: string; lastName: string; phone: string }[]>`
        SELECT id, "firstName", "lastName", phone FROM clients
        WHERE "tenantId" = ${automation.tenantId}
          AND "dateOfBirth" IS NOT NULL
          AND EXTRACT(MONTH FROM "dateOfBirth") = ${month}
          AND EXTRACT(DAY FROM "dateOfBirth") = ${day}`;
      for (const client of clients) {
        await runAutomation(automation.tenantId, "BIRTHDAY", { client, dedupeKey: `birthday:${client.id}:${year}` });
      }
    }
  }
}
