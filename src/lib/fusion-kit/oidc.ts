// Fusion Kit — accesso con Fusion ID (OIDC, authorization code + PKCE).
// Sorgente unica: fusion-id/kit/next/fusion-kit. Non modificare la copia nel prodotto:
// modifica la sorgente e rilancia fusion-id/kit/sync.sh.
//
// Nessuna dipendenza: solo Web Crypto/Request/Response, funziona con Next 14 e 16.
// L'id_token arriva direttamente dal token endpoint su TLS: per OIDC Core §3.1.3.7
// basta validare il server TLS, quindi non serve verificare la firma con JWKS.

import crypto from "node:crypto";

import { fusionConfig } from "./config";

const STATE_COOKIE = "fusion_oidc";
const STATE_TTL_S = 600;

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint: string;
};

let discoveryCache: { at: number; value: Discovery } | null = null;

async function discovery(): Promise<Discovery> {
  if (discoveryCache && Date.now() - discoveryCache.at < 3600_000) return discoveryCache.value;
  const { issuer } = fusionConfig();
  const res = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Servizio di accesso non raggiungibile (${res.status})`);
  const value = (await res.json()) as Discovery;
  discoveryCache = { at: Date.now(), value };
  return value;
}

export type FusionClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  givenName?: string;
  familyName?: string;
  /** Metodi usati per entrare (pwd, otp, user presence, federated…). */
  amr: string[];
  idToken: string;
};

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", fusionConfig().clientSecret).update(value).digest("base64url");
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  const secure = fusionConfig().appUrl.startsWith("https://") ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return undefined;
}

/** Percorso interno sicuro a cui tornare dopo il login (mai un URL esterno). */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/**
 * Risposta di redirect verso la pagina di accesso di Fusion ID.
 * `google: true` salta la scelta e va dritto a "Accedi con Google".
 */
export async function startFusionLogin(
  request: Request,
  opts: { returnTo?: string | null; google?: boolean; loginHint?: string; prompt?: "login" | "create" | "select_account" } = {},
): Promise<Response> {
  const cfg = fusionConfig();
  const d = await discovery();
  const state = b64url(crypto.randomBytes(24));
  const nonce = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());

  const scopes = ["openid", "email", "profile", "offline_access"];
  if (opts.google && cfg.googleIdpId) scopes.push(`urn:zitadel:iam:org:idp:id:${cfg.googleIdpId}`);

  const url = new URL(d.authorization_endpoint);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", `${cfg.appUrl}/auth/fusion/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("ui_locales", "it");
  if (opts.loginHint) url.searchParams.set("login_hint", opts.loginHint);
  if (opts.prompt) url.searchParams.set("prompt", opts.prompt);

  const payload = b64url(Buffer.from(JSON.stringify({ state, nonce, verifier, returnTo: safeReturnTo(opts.returnTo) })));
  void request;
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), "Set-Cookie": cookieHeader(STATE_COOKIE, `${payload}.${sign(payload)}`, STATE_TTL_S) },
  });
}

export class FusionLoginError extends Error {}

/** Cookie da impostare sulla risposta finale per cancellare lo stato del login. */
export const clearFusionStateCookie = () => cookieHeader(STATE_COOKIE, "", 0);

/**
 * Completa il login al ritorno da Fusion ID: verifica state/nonce, scambia il codice
 * e restituisce l'identità. Il prodotto poi collega l'utente e crea la SUA sessione.
 */
export async function finishFusionLogin(request: Request): Promise<{ claims: FusionClaims; returnTo: string | null }> {
  const cfg = fusionConfig();
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) throw new FusionLoginError(url.searchParams.get("error_description") ?? error);

  const raw = readCookie(request, STATE_COOKIE);
  const [payload, mac] = raw?.split(".") ?? [];
  if (!payload || !mac || mac.length !== sign(payload).length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sign(payload)))) {
    throw new FusionLoginError("Sessione di accesso scaduta: riprova.");
  }
  const st = JSON.parse(Buffer.from(payload, "base64url").toString()) as { state: string; nonce: string; verifier: string; returnTo: string | null };
  if (url.searchParams.get("state") !== st.state) throw new FusionLoginError("Richiesta di accesso non valida: riprova.");
  const code = url.searchParams.get("code");
  if (!code) throw new FusionLoginError("Codice di accesso mancante.");

  const d = await discovery();
  const res = await fetch(d.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${cfg.appUrl}/auth/fusion/callback`,
      code_verifier: st.verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new FusionLoginError(`Il servizio di accesso ha rifiutato l'accesso (${res.status}).`);
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new FusionLoginError("Risposta del servizio di accesso senza id_token.");

  const c = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()) as Record<string, unknown>;
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  const now = Math.floor(Date.now() / 1000);
  if (c.iss !== d.issuer || !aud.includes(cfg.clientId) || typeof c.exp !== "number" || c.exp < now - 30 || c.nonce !== st.nonce) {
    throw new FusionLoginError("Token di accesso non valido.");
  }
  if (typeof c.sub !== "string" || typeof c.email !== "string") throw new FusionLoginError("Il servizio di accesso non ha fornito l'email.");

  return {
    claims: {
      sub: c.sub,
      email: c.email.trim().toLowerCase(),
      emailVerified: c.email_verified === true,
      name: typeof c.name === "string" ? c.name : c.email,
      givenName: typeof c.given_name === "string" ? c.given_name : undefined,
      familyName: typeof c.family_name === "string" ? c.family_name : undefined,
      amr: Array.isArray(c.amr) ? (c.amr as string[]) : [],
      idToken: tokens.id_token,
    },
    returnTo: st.returnTo,
  };
}

/** URL di uscita da Fusion ID (chiude la sessione unica di tutti i prodotti). */
export async function fusionLogoutUrl(postLogoutPath = "/login"): Promise<string> {
  const cfg = fusionConfig();
  const d = await discovery();
  const url = new URL(d.end_session_endpoint);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("post_logout_redirect_uri", `${cfg.appUrl}${postLogoutPath}`);
  return url.toString();
}
