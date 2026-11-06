/**
 * Client di Fusion WA, il gateway WhatsApp di Fusionsoft (lo stesso usato dal CRM).
 * Fusion Beauty è un'"App" di Fusion WA: chiave e secret dell'App autenticano le
 * chiamate server-to-server, e ogni centro è un cliente dell'App con
 * externalCustomerId = tenant.id. Fusion WA custodisce token Meta, numero e
 * webhook: qui non si parla mai direttamente con Meta.
 *
 * Niente "server-only": lo importa anche il worker (tsx), dove quel pacchetto
 * lancerebbe un errore. Non va comunque mai importato da un client component
 * (legge il secret dalle variabili d'ambiente).
 */

const FUSION_WA_BASE_URL = (process.env.FUSION_WA_BASE_URL ?? "https://wa.fusionsoft.it").replace(/\/$/, "");

export function fusionWaBaseUrl() {
  return FUSION_WA_BASE_URL;
}

export function isFusionWaConfigured() {
  return Boolean(process.env.FUSION_WA_API_KEY && process.env.FUSION_WA_API_SECRET);
}

export type FusionWaSendResult = { ok: true; wamid: string | null } | { ok: false; error: string };

export type FusionWaTemplate = {
  externalId: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  body: string;
  variableCount: number;
  headerText?: string | null;
  footerText?: string | null;
  buttons?: string[];
  hasMediaHeader?: boolean;
};

export type FusionWaConnectionState = {
  customerStatus: "NOT_FOUND" | "INACTIVE" | "ACTIVE" | "REVOKED";
  integrationEnabled: boolean;
  connection: {
    id: string;
    wabaId: string;
    phoneNumberId: string;
    phoneNumber: string;
    status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
    billingStatus: string;
    operational: boolean;
  } | null;
};

function authHeaders(): Record<string, string> {
  const apiKey = process.env.FUSION_WA_API_KEY;
  const apiSecret = process.env.FUSION_WA_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("WhatsApp non configurato: mancano FUSION_WA_API_KEY e FUSION_WA_API_SECRET.");
  }
  return { "x-fusionwa-api-key": apiKey, "x-fusionwa-api-secret": apiSecret };
}

type JsonResult = { ok: true; status: number; data: Record<string, unknown> | null } | { ok: false; error: string };

async function request(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<JsonResult> {
  try {
    const res = await fetch(`${FUSION_WA_BASE_URL}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { ...authHeaders(), ...(init.body ? { "Content-Type": "application/json" } : {}) },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Fusion WA non raggiungibile." };
  }
}

function errorOf(data: Record<string, unknown> | null, status: number): string {
  const details = data?.details as { message?: string } | null | undefined;
  return details?.message ?? (typeof data?.error === "string" ? data.error : `Errore Fusion WA (${status})`);
}

async function send(body: Record<string, unknown>): Promise<FusionWaSendResult> {
  const res = await request("/api/v1/messages/send", { body });
  if (!res.ok) return res;
  if (res.status >= 400 || res.data?.status !== "success") return { ok: false, error: errorOf(res.data, res.status) };
  return { ok: true, wamid: typeof res.data.messageId === "string" ? res.data.messageId : null };
}

export function sendText(tenantId: string, to: string, message: string) {
  return send({ externalCustomerId: tenantId, toPhoneNumber: to, message });
}

export function sendTemplate(tenantId: string, to: string, template: { name: string; language: string; bodyParams: string[] }) {
  return send({
    externalCustomerId: tenantId,
    toPhoneNumber: to,
    template: {
      name: template.name,
      language: template.language,
      ...(template.bodyParams.length > 0 ? { bodyParams: template.bodyParams } : {}),
    },
  });
}

export async function listTemplates(tenantId: string): Promise<{ ok: true; templates: FusionWaTemplate[] } | { ok: false; error: string }> {
  const res = await request(`/api/v1/templates?${new URLSearchParams({ externalCustomerId: tenantId })}`);
  if (!res.ok) return res;
  if (res.status >= 400 || res.data?.status !== "success") return { ok: false, error: errorOf(res.data, res.status) };
  return { ok: true, templates: (res.data.templates as FusionWaTemplate[] | undefined) ?? [] };
}

export async function createTemplate(input: {
  tenantId: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  headerText?: string;
  bodyText: string;
  bodyExamples: string[];
  footerText?: string;
  buttons?: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await request("/api/v1/templates", {
    body: {
      externalCustomerId: input.tenantId,
      name: input.name,
      language: input.language,
      category: input.category,
      headerText: input.headerText || undefined,
      bodyText: input.bodyText,
      bodyExamples: input.bodyExamples,
      footerText: input.footerText || undefined,
      buttons: input.buttons?.length ? input.buttons : undefined,
    },
  });
  if (!res.ok) return res;
  if (res.status >= 400 || res.data?.status !== "success") return { ok: false, error: errorOf(res.data, res.status) };
  return { ok: true };
}

export async function deleteTemplate(tenantId: string, name: string, externalId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const query = new URLSearchParams({ externalCustomerId: tenantId, name, ...(externalId ? { externalId } : {}) });
  const res = await request(`/api/v1/templates?${query}`, { method: "DELETE" });
  if (!res.ok) return res;
  if (res.status >= 400) return { ok: false, error: errorOf(res.data, res.status) };
  return { ok: true };
}

export async function getConnectionState(tenantId: string): Promise<{ ok: true; state: FusionWaConnectionState } | { ok: false; error: string }> {
  const res = await request(`/api/v1/connections/status?${new URLSearchParams({ externalCustomerId: tenantId })}`, { timeoutMs: 10_000 });
  if (!res.ok) return res;
  if (res.status >= 400 || res.data?.status !== "success") return { ok: false, error: errorOf(res.data, res.status) };
  return { ok: true, state: res.data as unknown as FusionWaConnectionState };
}

export async function resetConnection(tenantId: string, phoneNumberId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await request("/api/v1/connections/reset", { body: { externalCustomerId: tenantId, expectedPhoneNumberId: phoneNumberId } });
  if (!res.ok) return res;
  if (res.status >= 400) return { ok: false, error: errorOf(res.data, res.status) };
  return { ok: true };
}

/**
 * Token a breve scadenza (30 minuti) legato a un solo centro, da passare al widget
 * di collegamento nel browser al posto di chiave e id: chiesto server-to-server.
 */
export async function getWidgetToken(tenantId: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const res = await request("/api/v1/widget/token", { body: { customerId: tenantId }, timeoutMs: 10_000 });
  if (!res.ok) return res;
  if (res.status >= 400 || typeof res.data?.token !== "string") return { ok: false, error: errorOf(res.data, res.status) };
  return { ok: true, token: res.data.token };
}
