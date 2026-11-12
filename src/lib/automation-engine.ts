import type { AutomationTrigger, Prisma } from "@/generated/prisma/client";
import {
  parseStoredSteps,
  parseStoredTriggerConfig,
  type AutomationStep,
  type Condition,
} from "@/lib/automations";
import { prisma } from "@/lib/prisma";
import { appointmentVars, sendWhatsappTemplate, sendWhatsappText } from "@/lib/whatsapp";
import { renderVariables, type TemplateVars } from "@/lib/whatsapp-shared";

/**
 * Motore delle automazioni (come workflow-engine.ts del CRM, in piccolo).
 * Ogni cliente che entra in un'automazione è un AutomationRun: i passi si
 * eseguono subito fino a un'attesa, poi il worker riprende la corsa quando
 * scade (processWaitingRuns, ogni minuto). I trigger a tempo (promemoria,
 * dopo il trattamento, compleanni, clienti inattive) li cerca
 * runAutomationScans ogni 15 minuti; la triggerKey univoca evita i doppi.
 *
 * Le azioni sono "best effort": un invio WhatsApp non riuscito finisce nel
 * diario della corsa e si passa al passo dopo. Nessuna funzione esportata
 * lancia: una prenotazione o un form non devono mai fallire per un'automazione.
 * Importato anche dal worker (tsx): niente "server-only".
 */

const TIME_ZONE = "Europe/Rome";
const QUIET_START = 9;
const QUIET_END = 20;

type RunContext = { vars?: TemplateVars; appointmentId?: string };
type LogEntry = { at: string; step: string; ok: boolean; message: string };

export type TriggerResult = { started: number; sent: boolean };

// ── Tempo (ora di Roma) ──────────────────────────────────────────────────────

function romeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Istante UTC di una certa ora (di Roma) del giorno di `date` + offsetDays. */
function romeTime(date: Date, offsetDays: number, hour: number): Date {
  const { year, month, day } = romeParts(date);
  const guess = new Date(Date.UTC(year, month - 1, day + offsetDays, hour, 0));
  // Differenza tra l'ora di Roma ottenuta e quella voluta (CET/CEST): si corregge.
  const got = romeParts(guess);
  const drift = (got.hour - hour + 24) % 24;
  return new Date(guess.getTime() - drift * 3600_000);
}

/** Prossima apertura della fascia 9–20 (adesso, se ci siamo già dentro). */
export function nextSendTime(now: Date): Date {
  const { hour } = romeParts(now);
  if (hour >= QUIET_START && hour < QUIET_END) return now;
  return romeTime(now, hour >= QUIET_END ? 1 : 0, QUIET_START);
}

// ── Avvio ────────────────────────────────────────────────────────────────────

/**
 * Fa partire le automazioni attive del centro per questo evento.
 * `filter` restringe quelle con un'impostazione (form, trattamento, parola chiave).
 */
export async function triggerAutomations(
  tenantId: string,
  trigger: AutomationTrigger,
  input: {
    clientId: string;
    triggerKey: string;
    context?: RunContext;
    filter?: { formId?: string; serviceId?: string; message?: string };
  }
): Promise<TriggerResult> {
  const result: TriggerResult = { started: 0, sent: false };
  try {
    const automations = await prisma.automation.findMany({ where: { tenantId, trigger, status: "ACTIVE" } });
    for (const automation of automations) {
      const config = parseStoredTriggerConfig(automation.triggerConfig);
      if (config.formId && input.filter?.formId !== undefined && config.formId !== input.filter.formId) continue;
      if (config.serviceIds?.length && input.filter?.serviceId && !config.serviceIds.includes(input.filter.serviceId)) continue;
      if (config.keyword && !matchesKeyword(input.filter?.message ?? "", config.keyword)) continue;

      const outcome = await startRun(automation, input);
      if (outcome) {
        result.started++;
        if (outcome.sent) result.sent = true;
      }
    }
  } catch (err) {
    console.error(`[automazioni] trigger ${trigger} non riuscito:`, err);
  }
  return result;
}

function matchesKeyword(message: string, keyword: string) {
  const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const words = normalize(message).split(/[^a-z0-9]+/);
  return words.includes(normalize(keyword));
}

async function startRun(
  automation: { id: string; tenantId: string; allowReentry: boolean },
  input: { clientId: string; triggerKey: string; context?: RunContext }
): Promise<{ sent: boolean } | null> {
  if (!automation.allowReentry) {
    const before = await prisma.automationRun.findFirst({ where: { automationId: automation.id, clientId: input.clientId }, select: { id: true } });
    if (before) return null;
  }
  let runId: string;
  try {
    const run = await prisma.automationRun.create({
      data: {
        tenantId: automation.tenantId,
        automationId: automation.id,
        clientId: input.clientId,
        triggerKey: input.triggerKey,
        context: (input.context ?? {}) as Prisma.InputJsonValue,
      },
    });
    runId = run.id;
  } catch (err) {
    // Stesso evento già gestito (doppio clic, due giri del worker…)
    if ((err as { code?: string }).code === "P2002") return null;
    throw err;
  }
  return advanceRun(runId);
}

// ── Esecuzione ───────────────────────────────────────────────────────────────

type Node = { step: AutomationStep; next: string | null };

/** Albero di passi → tabella "id → passo successivo", per riprendere da qualsiasi punto. */
function compile(steps: AutomationStep[]): { first: string | null; nodes: Map<string, Node> } {
  const nodes = new Map<string, Node>();
  function walk(list: AutomationStep[], after: string | null): string | null {
    list.forEach((step, i) => {
      const next = i + 1 < list.length ? list[i + 1].id : after;
      nodes.set(step.id, { step, next });
      if (step.type === "CONDITION") {
        walk(step.then, next);
        walk(step.else, next);
      }
    });
    return list[0]?.id ?? after;
  }
  const first = walk(steps, null);
  return { first, nodes };
}

async function advanceRun(runId: string): Promise<{ sent: boolean }> {
  const run = await prisma.automationRun.findUnique({
    where: { id: runId },
    include: {
      automation: true,
      client: true,
      tenant: { select: { name: true, slug: true, isActive: true } },
    },
  });
  if (!run) return { sent: false };
  const log: LogEntry[] = [];
  let sent = false;

  async function finish(data: Prisma.AutomationRunUpdateInput) {
    const previous = Array.isArray(run!.log) ? (run!.log as LogEntry[]) : [];
    await prisma.automationRun.update({
      where: { id: runId },
      data: { ...data, log: [...previous, ...log].slice(-200) as Prisma.InputJsonValue },
    });
  }

  // In pausa (o centro sospeso): la corsa aspetta, riprende quando si riattiva.
  if (run.automation.status !== "ACTIVE" || !run.tenant.isActive) {
    await finish({ status: "WAITING", resumeAt: new Date(Date.now() + 60 * 60_000) });
    return { sent };
  }

  const { automation, client } = run;
  const context = (run.context ?? {}) as RunContext;
  const { first, nodes } = compile(parseStoredSteps(automation.steps));
  let currentId = run.currentStepId ?? (run.log && (run.log as unknown[]).length ? null : first);
  const vars: TemplateVars = {
    nome: client.firstName,
    cognome: client.lastName,
    centro: run.tenant.name,
    prenota: `${(process.env.APP_BASE_URL ?? "https://beauty.fusionsoft.it").replace(/\/$/, "")}/embed/${run.tenant.slug}`,
    telefono: client.phone,
    scadenza: new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, day: "numeric", month: "long" }).format(new Date(Date.now() + 14 * 86_400_000)),
    ...context.vars,
  };
  const note = (step: string, ok: boolean, message: string) => log.push({ at: new Date().toISOString(), step, ok, message });

  if (automation.stopOnReply && (await repliedSince(run.tenantId, client.id, run.createdAt))) {
    note("Stop", true, "La cliente ha risposto: automazione fermata.");
    await finish({ status: "STOPPED", currentStepId: null, resumeAt: null });
    return { sent };
  }

  for (let guard = 0; currentId && guard < 100; guard++) {
    const node = nodes.get(currentId);
    if (!node) {
      note("—", false, "Il passo non esiste più (automazione modificata): corsa chiusa.");
      break;
    }
    const { step, next } = node;

    if (step.type === "WAIT") {
      const ms = step.amount * { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }[step.unit];
      const resumeAt = new Date(Date.now() + ms);
      note("Aspetta", true, `Riprende ${formatWhen(resumeAt)}.`);
      await finish({ status: "WAITING", currentStepId: next, resumeAt });
      return { sent };
    }

    if ((step.type === "SEND_TEMPLATE" || step.type === "SEND_TEXT") && automation.quietHours) {
      const when = nextSendTime(new Date());
      if (when.getTime() > Date.now()) {
        note("Orario", true, `Fuori dalla fascia 9–20: invio ${formatWhen(when)}.`);
        await finish({ status: "WAITING", currentStepId: step.id, resumeAt: when });
        return { sent };
      }
    }

    if (step.type === "SEND_TEMPLATE") {
      // Meta rifiuta i parametri vuoti (al loro posto un trattino) e quelli con a capo.
      const params = step.params.map(
        (p) => renderVariables(p, vars).replace(/\{\{[a-z]+\}\}/gi, "").replace(/\s*\n+\s*/g, " · ").replace(/ {4,}/g, " ").trim() || "-"
      );
      const toStaff = Boolean(step.toPhone && step.toPhone.replace(/\D/g, "").length >= 8);
      const outcome = await sendWhatsappTemplate(run.tenantId, {
        phone: toStaff ? step.toPhone! : client.phone,
        clientId: toStaff ? null : client.id,
        templateName: step.templateName,
        language: step.language,
        templateBody: step.templateBody,
        params,
        dedupeKey: `auto:${run.id}:${step.id}`,
      });
      if (outcome.ok) sent = true;
      note(`WhatsApp “${step.templateName}”${toStaff ? " allo staff" : ""}`, outcome.ok, outcome.ok ? "Inviato." : outcome.error);
    } else if (step.type === "SEND_TEXT") {
      const outcome = await sendWhatsappText(run.tenantId, { phone: client.phone, clientId: client.id, body: renderVariables(step.message, vars) });
      if (outcome.ok) sent = true;
      note("WhatsApp (testo)", outcome.ok, outcome.ok ? "Inviato." : outcome.error);
    } else if (step.type === "ADD_NOTE") {
      const date = new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
      const line = `[${automation.name}, ${date}] ${renderVariables(step.text, vars)}`;
      const current = await prisma.client.findUnique({ where: { id: client.id }, select: { notes: true } });
      await prisma.client.update({ where: { id: client.id }, data: { notes: [current?.notes, line].filter(Boolean).join("\n") } });
      note("Nota", true, "Aggiunta alla scheda.");
    } else if (step.type === "ADD_INTEREST") {
      const current = await prisma.client.findUnique({ where: { id: client.id }, select: { interests: true } });
      if (current && !current.interests.includes(step.interest)) {
        await prisma.client.update({ where: { id: client.id }, data: { interests: [...current.interests, step.interest] } });
      }
      note("Interesse", true, `“${step.interest}” in scheda.`);
    } else if (step.type === "CONDITION") {
      const yes = await evaluate(step.condition, run.tenantId, client.id, run.createdAt);
      note("Condizione", true, yes ? "Sì" : "No");
      const branch = yes ? step.then : step.else;
      currentId = branch[0]?.id ?? next;
      continue;
    }

    currentId = next;
  }

  await finish({ status: "COMPLETED", currentStepId: null, resumeAt: null, lastError: log.find((l) => !l.ok)?.message ?? null });
  return { sent };
}

function formatWhen(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

async function repliedSince(tenantId: string, clientId: string, since: Date) {
  const reply = await prisma.whatsappMessage.findFirst({
    where: { tenantId, clientId, direction: "INBOUND", createdAt: { gt: since } },
    select: { id: true },
  });
  return Boolean(reply);
}

async function evaluate(condition: Condition, tenantId: string, clientId: string, since: Date): Promise<boolean> {
  switch (condition.field) {
    case "HAS_FUTURE_APPOINTMENT":
      return (await prisma.appointment.count({ where: { tenantId, clientId, status: { in: ["BOOKED", "CONFIRMED"] }, startTime: { gt: new Date() } } })) > 0;
    case "VISITS_AT_LEAST": {
      const visits = await prisma.appointment.count({ where: { tenantId, clientId, status: "COMPLETED" } });
      return visits >= Number(condition.value ?? 1);
    }
    case "HAS_INTEREST": {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { interests: true } });
      const wanted = (condition.value ?? "").toLowerCase();
      return Boolean(client?.interests.some((i) => i.toLowerCase() === wanted));
    }
    case "HAS_EMAIL": {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { email: true } });
      return Boolean(client?.email);
    }
    case "MARKETING_CONSENT":
      return hasMarketingConsent(tenantId, clientId);
    case "REPLIED":
      return repliedSince(tenantId, clientId, since);
  }
}

/** Consenso marketing firmato, accordato e non revocato. */
export async function hasMarketingConsent(tenantId: string, clientId: string) {
  const record = await prisma.consentRecord.findFirst({
    where: { tenantId, clientId, status: "SIGNED", granted: true, revokedAt: null, template: { type: "MARKETING" } },
    select: { id: true },
  });
  return Boolean(record);
}

// ── Worker ───────────────────────────────────────────────────────────────────

/** Riprende le corse la cui attesa è scaduta (worker, ogni minuto). */
export async function processWaitingRuns(now = new Date()) {
  const due = await prisma.automationRun.findMany({
    where: { status: "WAITING", resumeAt: { lte: now } },
    select: { id: true },
    orderBy: { resumeAt: "asc" },
    take: 200,
  });
  for (const { id } of due) {
    // Presa in carico atomica: due worker non riprendono la stessa corsa.
    const claimed = await prisma.automationRun.updateMany({ where: { id, status: "WAITING" }, data: { status: "RUNNING" } });
    if (claimed.count !== 1) continue;
    try {
      await advanceRun(id);
    } catch (err) {
      console.error(`[automazioni] corsa ${id} non riuscita:`, err);
      await prisma.automationRun.update({ where: { id }, data: { status: "FAILED", lastError: err instanceof Error ? err.message : "Errore" } });
    }
  }
}

/** Una cliente ha scritto: si fermano le corse con "fermati se risponde". */
export async function stopRunsOnReply(tenantId: string, clientId: string) {
  await prisma.automationRun.updateMany({
    where: { tenantId, clientId, status: "WAITING", automation: { stopOnReply: true } },
    data: { status: "STOPPED", resumeAt: null },
  });
}

/** Trigger a tempo: prima/dopo l'appuntamento, compleanno, cliente inattiva (ogni 15 minuti). */
export async function runAutomationScans(now = new Date()) {
  const automations = await prisma.automation.findMany({
    where: { status: "ACTIVE", trigger: { in: ["BEFORE_APPOINTMENT", "AFTER_APPOINTMENT", "BIRTHDAY", "CLIENT_INACTIVE"] }, tenant: { isActive: true } },
  });

  for (const automation of automations) {
    const config = parseStoredTriggerConfig(automation.triggerConfig);
    const services = config.serviceIds?.length ? { serviceId: { in: config.serviceIds } } : {};
    try {
      if (automation.trigger === "BEFORE_APPOINTMENT" && config.hours) {
        // Appuntamenti che entrano adesso nella finestra "N ore prima" (con un
        // margine per i giri del worker), ma non quelli già iniziati.
        const lead = config.hours * 3_600_000;
        const margin = Math.max(3_600_000, lead / 4);
        const appointments = await prisma.appointment.findMany({
          where: {
            tenantId: automation.tenantId,
            status: { in: ["BOOKED", "CONFIRMED"] },
            startTime: { gt: now, lte: new Date(now.getTime() + lead), gte: new Date(now.getTime() + lead - margin) },
            ...services,
          },
          include: { service: true, operator: { select: { firstName: true } } },
        });
        for (const appointment of appointments) {
          await startRun(automation, {
            clientId: appointment.clientId,
            triggerKey: `appointment:${appointment.id}:${appointment.startTime.toISOString()}`,
            context: { vars: appointmentVars(appointment), appointmentId: appointment.id },
          });
        }
      }

      if (automation.trigger === "AFTER_APPOINTMENT" && config.hours) {
        const lag = config.hours * 3_600_000;
        // Solo i trattamenti che arrivano adesso alla scadenza (con un margine
        // per i giri del worker): accendendo l'automazione non deve scrivere a
        // chi è venuta giorni fa.
        const margin = Math.max(3 * 3_600_000, lag / 4);
        const appointments = await prisma.appointment.findMany({
          where: {
            tenantId: automation.tenantId,
            status: "COMPLETED",
            endTime: { lte: new Date(now.getTime() - lag), gte: new Date(now.getTime() - lag - margin) },
            ...services,
          },
          include: { service: true, operator: { select: { firstName: true } } },
        });
        for (const appointment of appointments) {
          await startRun(automation, {
            clientId: appointment.clientId,
            triggerKey: `appointment:${appointment.id}`,
            context: { vars: appointmentVars(appointment), appointmentId: appointment.id },
          });
        }
      }

      if (automation.trigger === "BIRTHDAY") {
        const { month, day, year } = romeParts(now);
        const clients = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM clients
          WHERE "tenantId" = ${automation.tenantId}
            AND "dateOfBirth" IS NOT NULL
            AND EXTRACT(MONTH FROM "dateOfBirth") = ${month}
            AND EXTRACT(DAY FROM "dateOfBirth") = ${day}`;
        for (const client of clients) {
          await startRun(automation, { clientId: client.id, triggerKey: `birthday:${year}` });
        }
      }

      if (automation.trigger === "CLIENT_INACTIVE" && config.days) {
        // Ultima visita tra "days" e "days + 14" giorni fa: si avvisa chi supera
        // la soglia adesso, non tutte le clienti perse da anni il giorno in cui
        // si accende l'automazione.
        const days = config.days;
        const rows = await prisma.$queryRaw<{ clientId: string; appointmentId: string }[]>`
          SELECT DISTINCT ON (a."clientId") a."clientId", a.id AS "appointmentId"
          FROM appointments a
          WHERE a."tenantId" = ${automation.tenantId} AND a.status = 'COMPLETED'
          ORDER BY a."clientId", a."startTime" DESC`;
        const lastVisits = await prisma.appointment.findMany({
          where: { id: { in: rows.map((r) => r.appointmentId) } },
          select: { id: true, clientId: true, startTime: true },
        });
        const from = now.getTime() - (days + 14) * 86_400_000;
        const to = now.getTime() - days * 86_400_000;
        for (const visit of lastVisits) {
          const t = visit.startTime.getTime();
          if (t < from || t > to) continue;
          const upcoming = await prisma.appointment.count({
            where: { clientId: visit.clientId, status: { in: ["BOOKED", "CONFIRMED"] }, startTime: { gt: now } },
          });
          if (upcoming > 0) continue;
          await startRun(automation, { clientId: visit.clientId, triggerKey: `inactive:${visit.id}` });
        }
      }
    } catch (err) {
      console.error(`[automazioni] controllo "${automation.name}" non riuscito:`, err);
    }
  }
}

// ── Scorciatoie per i punti dell'app ─────────────────────────────────────────

/** Trigger legati a un appuntamento (richiesta online, conferma). */
export async function triggerAppointmentAutomations(trigger: "BOOKING_REQUESTED" | "APPOINTMENT_CONFIRMED", appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { service: true, operator: { select: { firstName: true } } },
  });
  if (!appointment) return { started: 0, sent: false };
  return triggerAutomations(appointment.tenantId, trigger, {
    clientId: appointment.clientId,
    // Una conferma per appuntamento e orario: se lo sposti, parte la nuova conferma.
    triggerKey: `appointment:${appointment.id}:${appointment.startTime.toISOString()}`,
    context: { vars: appointmentVars(appointment), appointmentId: appointment.id },
    filter: { serviceId: appointment.serviceId },
  });
}

/** Nuova cliente in scheda (a mano, dal sito, da una prenotazione). */
export function triggerClientCreated(tenantId: string, clientId: string) {
  return triggerAutomations(tenantId, "CLIENT_CREATED", { clientId, triggerKey: "created" });
}
