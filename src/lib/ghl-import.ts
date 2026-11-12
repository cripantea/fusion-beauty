import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { findClientIdByPhone } from "@/lib/client-phone";
import { normalizePhoneForWhatsapp } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * Import da GoHighLevel (API v2, token "Private Integration" del subaccount,
 * solo lettura): contatti e conversazioni. Il token arriva dalla pagina di
 * import e resta solo in memoria per la durata dell'import.
 *
 * - Contatti: si crea solo chi non c'è (stesso telefono = stessa cliente);
 *   chi c'è già non si tocca. Nessuna automazione, nessun consenso.
 * - Conversazioni: i messaggi WhatsApp, SMS e chat diventano conversazioni in
 *   Messaggi con le date originali, già lette; wamid "ghl:<id>" evita doppioni
 *   se l'import si rilancia.
 */

const BASE = (process.env.GHL_API_BASE ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
const PAGE = 100;

type GhlContact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  tags?: string[];
  dateOfBirth?: string | null;
};

type GhlConversation = { id: string; contactId?: string; phone?: string | null; fullName?: string | null; lastMessageDate?: number; sort?: number[] };

type GhlMessage = {
  id: string;
  direction?: "inbound" | "outbound" | string;
  status?: string;
  messageType?: string;
  body?: string | null;
  dateAdded?: string;
  attachments?: string[];
};

export type ImportStats = {
  contactsSeen: number;
  contactsCreated: number;
  conversations: number;
  messagesImported: number;
  messagesSkipped: number;
};

class GhlError extends Error {}

async function ghl<T>(token: string, path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  // Limite di GHL (100 richieste ogni 10 secondi): si aspetta e si riprova.
  if (res.status === 429 && attempt < 5) {
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    return ghl<T>(token, path, attempt + 1);
  }
  if (res.status === 401) throw new GhlError("GoHighLevel non accetta il token: ricopialo dalla Private Integration.");
  if (res.status === 403) {
    throw new GhlError("Il token non ha i permessi: servono contacts.readonly, conversations.readonly e conversations/message.readonly.");
  }
  if (!res.ok) throw new GhlError(`GoHighLevel ha risposto ${res.status} su ${path.split("?")[0]}.`);
  return (await res.json()) as T;
}

/** Verifica rapida prima di partire: token e location validi. */
export async function checkGhlAccess(token: string, locationId: string): Promise<{ ok: true; total: number | null } | { ok: false; error: string }> {
  try {
    const data = await ghl<{ meta?: { total?: number } }>(token, `/contacts/?${new URLSearchParams({ locationId, limit: "1" })}`);
    return { ok: true, total: data.meta?.total ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "GoHighLevel non raggiungibile." };
  }
}

const CHANNEL_PREFIX: Record<string, string | null> = {
  TYPE_WHATSAPP: "",
  TYPE_SMS: "[SMS] ",
  TYPE_LIVE_CHAT: "[Chat del sito] ",
  TYPE_WEBCHAT: "[Chat del sito] ",
  TYPE_FACEBOOK: "[Facebook] ",
  TYPE_INSTAGRAM: "[Instagram] ",
  TYPE_GMB: "[Google] ",
};

function messageText(message: GhlMessage, prefix: string) {
  const body = (message.body ?? "").trim();
  const attachments = message.attachments?.length ? `📎 ${message.attachments.length === 1 ? "Allegato" : `${message.attachments.length} allegati`}` : "";
  return `${prefix}${[body, attachments].filter(Boolean).join(" · ") || "[Messaggio]"}`;
}

export async function runGhlImport(importId: string, tenantId: string, token: string, locationId: string) {
  const stats: ImportStats = { contactsSeen: 0, contactsCreated: 0, conversations: 0, messagesImported: 0, messagesSkipped: 0 };
  const save = (data: Partial<{ status: string; error: string | null; finishedAt: Date }> = {}) =>
    prisma.dataImport.update({ where: { id: importId }, data: { stats: stats as unknown as Prisma.InputJsonValue, ...data } });

  try {
    // ── Contatti ──
    const phoneByContact = new Map<string, string>();
    let startAfterId: string | undefined;
    let startAfter: number | undefined;
    for (let guard = 0; guard < 500; guard++) {
      const query = new URLSearchParams({ locationId, limit: String(PAGE) });
      if (startAfterId) query.set("startAfterId", startAfterId);
      if (startAfter) query.set("startAfter", String(startAfter));
      const page = await ghl<{ contacts?: GhlContact[]; meta?: { startAfterId?: string; startAfter?: number; nextPageUrl?: string | null } }>(
        token,
        `/contacts/?${query}`
      );
      const contacts = page.contacts ?? [];
      for (const contact of contacts) {
        stats.contactsSeen++;
        const raw = contact.phone?.trim();
        if (!raw || raw.replace(/\D/g, "").length < 8) continue;
        const phone = normalizePhoneForWhatsapp(raw);
        phoneByContact.set(contact.id, phone);
        if (await findClientIdByPhone(tenantId, phone)) continue;
        const name = (contact.firstName ?? contact.contactName ?? "").trim();
        const birth = contact.dateOfBirth ? new Date(contact.dateOfBirth) : null;
        await prisma.client.create({
          data: {
            tenantId,
            firstName: name || `+${phone}`,
            lastName: (contact.lastName ?? "").trim(),
            phone: `+${phone}`,
            email: contact.email?.trim().toLowerCase() || null,
            interests: (contact.tags ?? []).filter(Boolean).slice(0, 20),
            dateOfBirth: birth && !Number.isNaN(birth.getTime()) ? birth : null,
            acquisitionSource: "GoHighLevel",
          },
        });
        stats.contactsCreated++;
      }
      await save();
      if (contacts.length < PAGE || !page.meta?.startAfterId) break;
      startAfterId = page.meta.startAfterId;
      startAfter = page.meta.startAfter;
    }

    // ── Conversazioni ──
    let startAfterDate: number | undefined;
    const seen = new Set<string>();
    for (let guard = 0; guard < 500; guard++) {
      const query = new URLSearchParams({ locationId, limit: String(PAGE) });
      if (startAfterDate) query.set("startAfterDate", String(startAfterDate));
      const page = await ghl<{ conversations?: GhlConversation[] }>(token, `/conversations/search?${query}`);
      const conversations = (page.conversations ?? []).filter((c) => !seen.has(c.id));
      if (conversations.length === 0) break;

      for (const conversation of conversations) {
        seen.add(conversation.id);
        stats.conversations++;
        const raw = (conversation.contactId && phoneByContact.get(conversation.contactId)) || conversation.phone;
        if (!raw || raw.replace(/\D/g, "").length < 8) continue;
        const phone = normalizePhoneForWhatsapp(raw);
        const clientId = await findClientIdByPhone(tenantId, phone);

        let lastMessageId: string | undefined;
        for (let inner = 0; inner < 200; inner++) {
          const query = new URLSearchParams({ limit: String(PAGE) });
          if (lastMessageId) query.set("lastMessageId", lastMessageId);
          const data = await ghl<{ messages?: { messages?: GhlMessage[]; lastMessageId?: string; nextPage?: boolean } }>(
            token,
            `/conversations/${conversation.id}/messages?${query}`
          );
          const messages = data.messages?.messages ?? [];
          for (const message of messages) {
            const prefix = CHANNEL_PREFIX[message.messageType ?? ""];
            // Chiamate, email, note e attività interne di GHL non sono chat.
            if (prefix === undefined || prefix === null) {
              stats.messagesSkipped++;
              continue;
            }
            const wamid = `ghl:${message.id}`;
            const exists = await prisma.whatsappMessage.findUnique({ where: { wamid }, select: { id: true } });
            if (exists) continue;
            const inbound = message.direction === "inbound";
            const status = (message.status ?? "").toLowerCase();
            await prisma.whatsappMessage.create({
              data: {
                tenantId,
                clientId,
                phone,
                direction: inbound ? "INBOUND" : "OUTBOUND",
                status: inbound ? "RECEIVED" : status === "read" ? "READ" : status === "delivered" ? "DELIVERED" : status === "failed" ? "FAILED" : "SENT",
                body: messageText(message, prefix),
                wamid,
                readAt: inbound ? new Date() : null,
                createdAt: message.dateAdded ? new Date(message.dateAdded) : new Date(),
              },
            });
            stats.messagesImported++;
          }
          if (!data.messages?.nextPage || !data.messages.lastMessageId || messages.length === 0) break;
          lastMessageId = data.messages.lastMessageId;
        }
      }
      await save();
      const last = conversations[conversations.length - 1];
      const next = last.sort?.[0] ?? last.lastMessageDate;
      if (conversations.length < PAGE || !next) break;
      startAfterDate = next;
    }

    await save({ status: "DONE", finishedAt: new Date() });
  } catch (err) {
    console.error("[import GHL] non riuscito:", err);
    await save({ status: "FAILED", error: err instanceof Error ? err.message : "Import non riuscito.", finishedAt: new Date() });
  }
}
