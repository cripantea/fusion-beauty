import "server-only";

import { headers } from "next/headers";

/** URL pubblico dell'app (per i link inviati alle clienti): APP_BASE_URL, altrimenti l'host della richiesta. */
export async function getBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost:3000";
  const proto = store.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
