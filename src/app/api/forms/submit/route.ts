import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { findClientIdByPhone } from "@/lib/client-phone";
import { parseStoredForm, type FormFieldDef } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { runAutomation } from "@/lib/whatsapp";

/**
 * Invio di un form incorporato in un sito esterno (CORS aperto). Crea o aggiorna
 * la scheda cliente (stesso telefono = stessa cliente), salva la risposta e fa
 * partire l'eventuale messaggio WhatsApp automatico "Risposta a un form".
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Sotto questo tempo tra apertura e invio è un bot. */
const MIN_ELAPSED_MS = 2000;
const RATE_LIMIT = 8;
const RATE_WINDOW_SECONDS = 600;

const bodySchema = z.object({
  formId: z.string().min(1).max(50),
  values: z.record(z.string(), z.string().max(5000)),
  website: z.string().optional(),
  privacyConsent: z.boolean().optional(),
  elapsedMs: z.number().optional(),
  page: z.string().max(1000).optional(),
});

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function rateLimited(request: NextRequest, formId: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const key = `form-submit:${formId}:${ip}`;
  try {
    // Import pigro: la connessione Redis si apre al primo invio, non alla build.
    const { redis } = await import("@/lib/redis");
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_WINDOW_SECONDS);
    return count > RATE_LIMIT;
  } catch {
    // Redis giù: meglio accettare l'invio che perdere una cliente.
    return false;
  }
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Richiesta non valida.");
  const { formId, values, website, privacyConsent, elapsedMs, page } = parsed.data;

  const form = await prisma.form.findFirst({
    where: { id: formId, enabled: true, tenant: { isActive: true } },
    select: { id: true, name: true, tenantId: true, fields: true, settings: true },
  });
  if (!form) return fail("Questo modulo non è più disponibile.", 404);

  // Bot: si risponde "ok" senza salvare nulla, così non capiscono di essere stati scartati.
  if (website || (elapsedMs !== undefined && elapsedMs < MIN_ELAPSED_MS)) {
    return NextResponse.json({ ok: true }, { headers: CORS });
  }
  if (await rateLimited(request, form.id)) return fail("Troppi invii ravvicinati. Riprova tra qualche minuto.", 429);

  const { fields, settings } = parseStoredForm(form);
  if (settings.requirePrivacyConsent && privacyConsent !== true) return fail("Per inviare devi accettare l'informativa privacy.");

  const answers: { key: string; label: string; value: string }[] = [];
  const data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    dateOfBirth?: Date;
    city?: string;
    interests: string[];
    notes: string[];
  } = { interests: [], notes: [] };

  for (const field of fields as FormFieldDef[]) {
    if (field.type === "content") continue;
    const value = (values[field.key] ?? "").trim();
    if (field.required && !value) return fail(`Compila il campo "${field.label}".`);
    if (!value) continue;
    if ((field.type === "select" || field.type === "radio") && !field.options?.includes(value)) {
      return fail(`Scegli un'opzione valida per "${field.label}".`);
    }
    if (field.type === "email" && !z.email().safeParse(value).success) return fail("L'email non sembra corretta.");
    answers.push({ key: field.key, label: field.label, value });

    switch (field.clientField) {
      case "firstName":
        data.firstName = value;
        break;
      case "lastName":
        data.lastName = value;
        break;
      case "fullName": {
        const name = splitFullName(value);
        data.firstName = name.firstName;
        data.lastName = name.lastName || data.lastName;
        break;
      }
      case "phone":
        data.phone = value;
        break;
      case "email":
        data.email = value.toLowerCase();
        break;
      case "dateOfBirth": {
        const date = new Date(`${value}T00:00:00Z`);
        if (!Number.isNaN(date.getTime())) data.dateOfBirth = date;
        break;
      }
      case "city":
        data.city = value;
        break;
      case "interests":
        data.interests.push(value);
        break;
      case "notes":
        data.notes.push(value);
        break;
    }
  }

  const phoneDigits = (data.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length < 8 || phoneDigits.length > 15) return fail("Il numero di telefono non sembra corretto.");
  if (!data.firstName) return fail("Inserisci il tuo nome.");

  const tenantId = form.tenantId;
  const existingId = await findClientIdByPhone(tenantId, data.phone!);
  const existing = existingId
    ? await prisma.client.findUniqueOrThrow({
        where: { id: existingId },
        select: { id: true, email: true, notes: true, interests: true, city: true, dateOfBirth: true },
      })
    : null;

  const dateLabel = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  const noteLine = data.notes.length ? `[${form.name}, ${dateLabel}] ${data.notes.join(" — ")}` : null;

  const client = existing
    ? await prisma.client.update({
        where: { id: existing.id },
        data: {
          // I dati anagrafici già in scheda restano: il form aggiunge solo ciò che manca.
          email: existing.email ?? data.email,
          city: existing.city ?? data.city,
          dateOfBirth: existing.dateOfBirth ?? data.dateOfBirth,
          interests: Array.from(new Set([...existing.interests, ...data.interests])),
          notes: noteLine ? [existing.notes, noteLine].filter(Boolean).join("\n") : undefined,
        },
      })
    : await prisma.client.create({
        data: {
          tenantId,
          firstName: data.firstName,
          lastName: data.lastName ?? "",
          phone: data.phone!,
          email: data.email,
          city: data.city,
          dateOfBirth: data.dateOfBirth,
          interests: data.interests,
          notes: noteLine,
          acquisitionSource: `Sito web – ${form.name}`,
        },
      });

  await prisma.formSubmission.create({
    data: {
      tenantId,
      formId: form.id,
      clientId: client.id,
      payload: { answers, page: page ?? null, privacyConsent: privacyConsent ?? null },
    },
  });

  // Non blocca la risposta: il visitatore vede subito il ringraziamento.
  after(() => runAutomation(tenantId, "FORM_WELCOME", {
    client: { id: client.id, firstName: client.firstName, lastName: client.lastName, phone: client.phone },
    dedupeKey: `form_welcome:${client.id}:${form.id}:${dateLabel}`,
  }));

  return NextResponse.json({ ok: true }, { headers: CORS });
}
