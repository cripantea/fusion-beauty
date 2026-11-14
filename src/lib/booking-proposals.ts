import { stopAppointmentRuns, triggerAppointmentAutomations } from "@/lib/automation-engine";
import { findClashForParts } from "@/lib/availability";
import { appointmentParts, extraServicesSelect } from "@/lib/appointment-services";
import { listTemplates } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";
import { appointmentVars, hasActiveWhatsapp, sendWhatsappTemplate, sendWhatsappText } from "@/lib/whatsapp";

/**
 * Proposta di un altro orario per una richiesta online: la cliente riceve il
 * template "proposta_orario" con i pulsanti "Sì, confermo" / "Scelgo un altro
 * orario". La risposta arriva dal webhook citando il messaggio (context.id):
 * - conferma → l'appuntamento si sposta all'orario proposto, diventa
 *   confermato e parte la conferma WhatsApp (automazione "appuntamento confermato");
 * - altro orario → come su Treatwell/Fresha la richiesta non si chiude: torna
 *   all'operatrice per una nuova proposta; alla cliente arriva un messaggio che
 *   la avvisa e il link per scegliere da sola, se preferisce (la nuova
 *   prenotazione chiude quella vecchia).
 * Importato anche dal webhook/worker: niente "server-only".
 */

export const PROPOSAL_TEMPLATE = "proposta_orario";
// "Sì" solo se tutto il messaggio è un sì breve ("Sì, confermo", "ok grazie", "va bene!"):
// "Si può fare giovedì?" o "Sinceramente…" li legge il centro in Messaggi.
const ACCEPT_WORDS = new Set(["si", "sì", "ok", "okay", "va", "bene", "confermo", "conferma", "perfetto", "certo", "grazie", "mille", "benissimo"]);
function isAccept(reply: string): boolean {
  const words = reply
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;
  if (!["si", "sì", "ok", "okay", "va", "confermo", "conferma", "perfetto", "certo", "benissimo"].includes(words[0])) return false;
  return words.every((word) => ACCEPT_WORDS.has(word));
}

export async function proposeNewTime(
  tenantId: string,
  input: { appointmentId: string; start: Date; operatorId: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, tenantId },
    include: { client: true, service: true, extraServices: extraServicesSelect, tenant: { select: { name: true } } },
  });
  if (!appointment) return { ok: false, error: "Richiesta non trovata." };
  if (input.start.getTime() < Date.now()) return { ok: false, error: "L'orario proposto è già passato." };
  // Tutti i trattamenti dell'appuntamento, uno dopo l'altro.
  const minutes = appointment.service.durationMinutes + appointment.extraServices.reduce((sum, extra) => sum + extra.durationMinutes, 0);
  const end = new Date(input.start.getTime() + minutes * 60_000);

  // Né altri appuntamenti né impegni in quell'orario (controllo unico dell'agenda).
  // L'operatrice proposta fa il primo trattamento (e quelli senza un'altra operatrice).
  const clash = await findClashForParts(tenantId, {
    start: input.start,
    end,
    parts: appointmentParts({ ...appointment, operatorId: input.operatorId }),
    excludeAppointmentId: appointment.id,
  });
  if (clash) return { ok: false, error: clash };

  if (!(await hasActiveWhatsapp(tenantId))) return { ok: false, error: "WhatsApp non collegato: chiama la cliente per proporre l'orario." };
  const templates = await listTemplates(tenantId);
  const template = templates.ok ? templates.templates.find((t) => t.name === PROPOSAL_TEMPLATE && t.status === "APPROVED") : undefined;
  if (!template) return { ok: false, error: "Il messaggio “proposta_orario” non è ancora approvato da Meta." };

  const operator = input.operatorId ? await prisma.user.findUnique({ where: { id: input.operatorId }, select: { firstName: true } }) : null;
  const vars = appointmentVars({ startTime: input.start, service: appointment.service, extraServices: appointment.extraServices, operator });
  await prisma.bookingProposal.updateMany({ where: { appointmentId: appointment.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  const proposal = await prisma.bookingProposal.create({
    data: { tenantId, appointmentId: appointment.id, proposedStart: input.start, proposedEnd: end, operatorId: input.operatorId },
  });
  const sent = await sendWhatsappTemplate(tenantId, {
    phone: appointment.client.phone,
    clientId: appointment.client.id,
    templateName: template.name,
    language: template.language,
    templateBody: template.body,
    params: [appointment.client.firstName || "-", vars.trattamento ?? appointment.service.name, vars.data ?? "-", vars.ora ?? "-"],
    dedupeKey: `proposal:${proposal.id}`,
  });
  if (!sent.ok) {
    await prisma.bookingProposal.update({ where: { id: proposal.id }, data: { status: "CANCELLED" } });
    return { ok: false, error: sent.error };
  }
  await prisma.bookingProposal.update({ where: { id: proposal.id }, data: { messageId: sent.messageId } });
  return { ok: true };
}

/** Risposta a un messaggio (pulsante o testo che lo cita): se è una proposta, la gestisce. */
export async function handleProposalReply(tenantId: string, quotedWamid: string, reply: string, viaQuote = true): Promise<boolean> {
  const quoted = await prisma.whatsappMessage.findUnique({ where: { wamid: quotedWamid }, select: { id: true, tenantId: true } });
  if (!quoted || quoted.tenantId !== tenantId) return false;
  const proposal = await prisma.bookingProposal.findUnique({
    where: { messageId: quoted.id },
    include: {
      appointment: {
        include: { client: true, service: true, extraServices: extraServicesSelect, tenant: { select: { slug: true } } },
      },
    },
  });
  if (!proposal || proposal.status !== "PENDING") return false;
  const { appointment } = proposal;
  // Senza citazione si agisce solo su un "sì" chiaro; il resto lo legge il centro in Messaggi.
  if (!viaQuote && !isAccept(reply)) return false;

  if (isAccept(reply)) {
    // Nel frattempo l'orario può essersi occupato (o la richiesta annullata):
    // niente spostamento, la richiesta torna all'operatrice per un'altra proposta.
    const operatorId = proposal.operatorId ?? appointment.operatorId;
    const current = await prisma.appointment.findUnique({ where: { id: appointment.id }, select: { status: true } });
    const stillOpen = current?.status === "BOOKED" || current?.status === "CONFIRMED";
    const clash = stillOpen
      ? await findClashForParts(tenantId, {
          start: proposal.proposedStart,
          end: proposal.proposedEnd,
          parts: appointmentParts({ ...appointment, operatorId }),
          excludeAppointmentId: appointment.id,
        })
      : null;
    if (!stillOpen || clash) {
      const declined = await prisma.bookingProposal.updateMany({ where: { id: proposal.id, status: "PENDING" }, data: { status: "DECLINED", respondedAt: new Date() } });
      if (declined.count !== 1) return true;
      await sendWhatsappText(tenantId, {
        phone: appointment.client.phone,
        clientId: appointment.client.id,
        body: "Ci dispiace, quell'orario nel frattempo è stato occupato: ti scriviamo a breve con un'altra proposta.",
      });
      return true;
    }

    const claimed = await prisma.bookingProposal.updateMany({ where: { id: proposal.id, status: "PENDING" }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    if (claimed.count !== 1) return true;
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        startTime: proposal.proposedStart,
        endTime: proposal.proposedEnd,
        operatorId,
        status: "CONFIRMED",
      },
    });
    // Conferma alla cliente tramite l'automazione "appuntamento confermato"
    await triggerAppointmentAutomations("APPOINTMENT_CONFIRMED", appointment.id);
    return true;
  }

  // Solo la prima risposta conta: un doppio arrivo non manda due volte il messaggio.
  const declined = await prisma.bookingProposal.updateMany({ where: { id: proposal.id, status: "PENDING" }, data: { status: "DECLINED", respondedAt: new Date() } });
  if (declined.count !== 1) return true;
  // La cliente ha appena scritto: si può rispondere con un testo libero (finestra di 24 ore).
  const base = (process.env.APP_BASE_URL ?? "https://beauty.fusionsoft.it").replace(/\/$/, "");
  await sendWhatsappText(tenantId, {
    phone: appointment.client.phone,
    clientId: appointment.client.id,
    body: `Nessun problema! Ti scriviamo a breve con un altro orario. Se preferisci, puoi anche sceglierlo tu qui: ${base}/embed/${appointment.tenant.slug} oppure dirci qui quando ti è più comodo.`,
  });
  return true;
}

/** Proposta in attesa più recente (ultimi 7 giorni) della cliente: per i "sì" scritti senza citare il messaggio. */
export async function latestPendingProposalWamid(tenantId: string, clientId: string): Promise<string | null> {
  const proposal = await prisma.bookingProposal.findFirst({
    where: { tenantId, status: "PENDING", appointment: { clientId }, createdAt: { gt: new Date(Date.now() - 7 * 86_400_000) }, messageId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { messageId: true },
  });
  if (!proposal?.messageId) return null;
  const message = await prisma.whatsappMessage.findUnique({ where: { id: proposal.messageId }, select: { wamid: true } });
  return message?.wamid ?? null;
}

/** Appuntamento annullato o spostato a mano: le proposte in attesa non valgono più. */
export async function cancelPendingProposals(appointmentId: string) {
  await prisma.bookingProposal.updateMany({ where: { appointmentId, status: "PENDING" }, data: { status: "CANCELLED" } });
}

/**
 * Nuova prenotazione online della cliente: le sue richieste precedenti con una
 * proposta rifiutata sono superate e si chiudono (ha scelto lei l'orario).
 * Solo se l'ultima proposta è quella rifiutata e l'appuntamento non è stato
 * toccato dopo (es. spostato al telefono e confermato dal centro): quello resta.
 */
export async function closeSupersededRequests(tenantId: string, clientId: string, newAppointmentId: string) {
  const candidates = await prisma.appointment.findMany({
    where: {
      tenantId,
      clientId,
      id: { not: newAppointmentId },
      source: "ONLINE",
      status: { in: ["BOOKED", "CONFIRMED"] },
      proposals: { some: { status: "DECLINED" }, none: { status: "PENDING" } },
    },
    select: {
      id: true,
      updatedAt: true,
      proposals: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, respondedAt: true } },
    },
  });
  const superseded = candidates.filter((a) => {
    const latest = a.proposals[0];
    return latest?.status === "DECLINED" && latest.respondedAt && a.updatedAt.getTime() <= latest.respondedAt.getTime();
  });
  if (superseded.length === 0) return;
  await prisma.appointment.updateMany({
    where: { id: { in: superseded.map((a) => a.id) }, status: { in: ["BOOKED", "CONFIRMED"] } },
    data: { status: "CANCELLED" },
  });
  // Niente promemoria per le richieste chiuse.
  for (const { id } of superseded) await stopAppointmentRuns(id);
}

/**
 * Prenotazioni online su cui il centro deve agire (badge "Richieste"): quelle
 * da confermare e quelle in cui la cliente ha detto no allo spostamento.
 */
export function actionableRequestsWhere(tenantId: string) {
  const now = new Date();
  return {
    tenantId,
    source: "ONLINE" as const,
    OR: [
      { status: "BOOKED" as const, startTime: { gte: now } },
      {
        status: { in: ["BOOKED" as const, "CONFIRMED" as const] },
        proposals: { some: { status: "DECLINED" as const, createdAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } }, none: { status: "PENDING" as const } },
      },
    ],
  };
}
