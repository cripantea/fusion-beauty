// Fusion Kit — contratto comune tra il prodotto e Fusion Control (dashboard nel CRM).
//
//   GET  /api/fusion/health                 stato (dettagli solo con token)
//   GET  /api/fusion/tenants                clienti del prodotto
//   GET  /api/fusion/users                  utenti del prodotto
//   POST /api/fusion/tenants/:id/suspend    sospende un cliente
//   POST /api/fusion/tenants/:id/resume     lo riattiva
//   POST /api/fusion/impersonate            link monouso "entra come" (60 secondi)
//   POST /api/fusion/users/logout           chiude tutte le sessioni di un'email
//
// Autenticazione: Authorization: Bearer FUSION_KIT_SECRET (un segreto diverso per prodotto,
// lo conosce solo Fusion Control).

import crypto from "node:crypto";

import { kitConfig } from "./config";

export type KitTenant = {
  id: string;
  name: string;
  status: "active" | "suspended" | "trial" | "cancelled";
  plan?: string | null;
  users: number;
  createdAt: string;
  lastActivityAt?: string | null;
  contactEmail?: string | null;
};

export type KitUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
  fusionIdSub: string | null;
  createdAt: string;
};

export type KitAdapter = {
  /** Controlli di salute (es. database). Ognuno restituisce true/false o lancia. */
  checks?: Record<string, () => Promise<boolean>>;
  listTenants(): Promise<KitTenant[]>;
  listUsers(): Promise<KitUser[]>;
  setTenantSuspended(tenantId: string, suspended: boolean): Promise<void>;
  /** Utente con cui entrare per "entra come": l'admin del cliente se userId non è indicato. */
  impersonationTarget(tenantId: string, userId?: string): Promise<{ userId: string } | null>;
  revokeSessions(email: string): Promise<number>;
};

// ---------------------------------------------------------------------------
// Token firmati (HS256) con il segreto del Kit: widget assistenza e "entra come".
// ---------------------------------------------------------------------------

function hmac(data: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function signKitToken(payload: Record<string, unknown>, ttlSeconds: number, secret = kitConfig().secret): string {
  if (!secret) throw new Error("FUSION_KIT_SECRET mancante");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds })).toString("base64url");
  return `${header}.${body}.${hmac(`${header}.${body}`, secret)}`;
}

export function verifyKitToken<T extends Record<string, unknown>>(token: string, secret = kitConfig().secret): T | null {
  const [h, b, s] = token.split(".");
  if (!h || !b || !s || !secret) return null;
  const expected = hmac(`${h}.${b}`, secret);
  if (s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(b, "base64url").toString()) as T & { exp?: number };
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** Token per il widget di assistenza: dice a Fusion Desk chi sta scrivendo e da dove. */
export function supportWidgetToken(user: { id: string; email: string; name?: string | null; role?: string; tenantId?: string | null; tenantName?: string | null }) {
  return signKitToken({ product: kitConfig().product, ...user }, 12 * 3600);
}

/** Verifica un link "entra come" generato da /api/fusion/impersonate. */
export function verifyImpersonationToken(token: string): { userId: string; actor: string; reason: string } | null {
  const p = verifyKitToken<{ purpose?: string; userId?: string; actor?: string; reason?: string }>(token);
  if (!p || p.purpose !== "impersonate" || !p.userId) return null;
  return { userId: p.userId, actor: p.actor ?? "", reason: p.reason ?? "" };
}

// ---------------------------------------------------------------------------
// Errori → Fusion Control
// ---------------------------------------------------------------------------

/** Invia un errore a Fusion Control. Non lancia mai: un errore nel report non deve rompere l'app. */
export async function reportFusionError(error: unknown, context: { path?: string; method?: string; userEmail?: string | null; tenantId?: string | null; digest?: string } = {}) {
  const { controlUrl, secret, product } = kitConfig();
  if (!controlUrl || !secret || !product) return;
  const err = error instanceof Error ? error : new Error(String(error));
  try {
    await fetch(`${controlUrl}/api/fusion/errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}`, "X-Fusion-Product": product },
      body: JSON.stringify({
        source: "server",
        message: err.message.slice(0, 2000),
        stack: err.stack?.slice(0, 8000) ?? null,
        ...context,
        release: process.env.FUSION_RELEASE ?? process.env.GIT_COMMIT ?? null,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Control irraggiungibile: l'errore resta nei log del prodotto.
  }
}

// ---------------------------------------------------------------------------
// Handler per app/api/fusion/[...path]/route.ts
// ---------------------------------------------------------------------------

function authorized(request: Request): boolean {
  const { secret } = kitConfig();
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || given.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function segments(ctx: { params: unknown }): Promise<string[]> {
  const params = (await (ctx.params as Promise<{ path?: string[] }> | { path?: string[] })) ?? {};
  return params.path ?? [];
}

export function createFusionRoutes(adapter: KitAdapter, opts: { appUrl: () => string; version?: string }) {
  async function GET(request: Request, ctx: { params: unknown }) {
    const path = (await segments(ctx)).join("/");
    if (path === "health") {
      const started = Date.now();
      const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};
      for (const [name, fn] of Object.entries(adapter.checks ?? {})) {
        const t = Date.now();
        try {
          checks[name] = { ok: await fn(), ms: Date.now() - t };
        } catch (e) {
          checks[name] = { ok: false, ms: Date.now() - t, error: e instanceof Error ? e.message.slice(0, 200) : "errore" };
        }
      }
      const ok = Object.values(checks).every((c) => c.ok);
      if (!authorized(request)) return json({ ok }, ok ? 200 : 503);
      return json({
        ok,
        product: kitConfig().product,
        release: opts.version ?? process.env.FUSION_RELEASE ?? process.env.GIT_COMMIT ?? null,
        checks,
        ms: Date.now() - started,
        time: new Date().toISOString(),
      }, ok ? 200 : 503);
    }
    if (!authorized(request)) return json({ error: "unauthorized" }, 401);
    if (path === "tenants") return json({ tenants: await adapter.listTenants() });
    if (path === "users") return json({ users: await adapter.listUsers() });
    return json({ error: "not_found" }, 404);
  }

  async function POST(request: Request, ctx: { params: unknown }) {
    if (!authorized(request)) return json({ error: "unauthorized" }, 401);
    const seg = await segments(ctx);
    const body = (await request.json().catch(() => ({}))) as Record<string, string | undefined>;
    if (seg[0] === "tenants" && seg[1] && (seg[2] === "suspend" || seg[2] === "resume")) {
      await adapter.setTenantSuspended(seg[1], seg[2] === "suspend");
      return json({ ok: true });
    }
    if (seg[0] === "impersonate" && body.tenantId) {
      const target = await adapter.impersonationTarget(body.tenantId, body.userId);
      if (!target) return json({ error: "Nessun utente attivo per questo cliente" }, 404);
      const token = signKitToken({ purpose: "impersonate", userId: target.userId, actor: body.actor ?? "", reason: body.reason ?? "" }, 60);
      return json({ url: `${opts.appUrl()}/auth/fusion/impersonate?token=${encodeURIComponent(token)}` });
    }
    if (seg[0] === "users" && seg[1] === "logout" && body.email) {
      return json({ revoked: await adapter.revokeSessions(body.email.toLowerCase()) });
    }
    return json({ error: "not_found" }, 404);
  }

  return { GET, POST };
}
