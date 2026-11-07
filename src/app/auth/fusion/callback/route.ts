import { NextResponse } from "next/server";

import { FusionLinkError, linkFusionIdentity, startBeautySession } from "@/lib/fusion-id";
import { clearFusionStateCookie, finishFusionLogin, fusionConfig, FusionLoginError } from "@/lib/fusion-kit";

export const dynamic = "force-dynamic";

/** Ritorno da Fusion ID: collega l'utente e apre la sessione di Beauty. */
export async function GET(request: Request) {
  const base = fusionConfig().appUrl;
  try {
    const { claims, returnTo } = await finishFusionLogin(request);
    const userId = await linkFusionIdentity(claims);
    const home = await startBeautySession(userId, true);
    const res = NextResponse.redirect(new URL(returnTo ?? home, base), 302);
    res.headers.append("Set-Cookie", clearFusionStateCookie());
    return res;
  } catch (err) {
    if (!(err instanceof FusionLoginError) && !(err instanceof FusionLinkError)) console.error("fusion-id callback", err);
    const message = err instanceof FusionLoginError || err instanceof FusionLinkError ? err.message : "Accesso non riuscito: riprova.";
    const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, base), 302);
    res.headers.append("Set-Cookie", clearFusionStateCookie());
    return res;
  }
}
