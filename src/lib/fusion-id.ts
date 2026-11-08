import "server-only";

import { cookies } from "next/headers";

import { setSessionCookie } from "@/lib/auth/cookies";
import { createSessionToken } from "@/lib/auth/session";
import { fusionIdEnabled, fusionLogoutUrl, type FusionClaims } from "@/lib/fusion-kit";
import { prisma } from "@/lib/prisma";

/** Cookie che ricorda che la sessione è nata da Fusion ID: all'uscita si chiude anche lì. */
export const FUSION_SSO_COOKIE = "fusion_sso";

export class FusionLinkError extends Error {}

/** Collega l'identità di Fusion ID all'utente Beauty (per sub, poi per email verificata). */
export async function linkFusionIdentity(claims: FusionClaims): Promise<string> {
  let user = await prisma.user.findUnique({ where: { fusionIdSub: claims.sub }, include: { tenant: { select: { isActive: true } } } });
  if (!user) {
    if (!claims.emailVerified) throw new FusionLinkError("Conferma prima la tua email (trovi il link nella posta), poi riprova.");
    const byEmail = await prisma.user.findUnique({ where: { email: claims.email } });
    if (!byEmail) throw new FusionLinkError(`Non c'è un account Beauty Fusion per ${claims.email}. Chiedi un invito al tuo centro.`);
    if (byEmail.fusionIdSub && byEmail.fusionIdSub !== claims.sub) throw new FusionLinkError("Questo account è già collegato a un altro accesso: entra con quello o scrivi all'assistenza.");
    user = await prisma.user.update({ where: { id: byEmail.id }, data: { fusionIdSub: claims.sub }, include: { tenant: { select: { isActive: true } } } });
  }
  if (!user.isActive) throw new FusionLinkError("Il tuo utente è disattivato: chiedi al titolare del centro.");
  if (user.tenant && !user.tenant.isActive) throw new FusionLinkError("Il centro associato a questo account è stato sospeso.");
  if (user.role === "SUPER_ADMIN" && !claims.amr.includes("mfa")) {
    throw new FusionLinkError("Per entrare come superadmin serve la verifica in due passaggi: attivala nella pagina di accesso.");
  }
  return user.id;
}

/** Apre la sessione di Beauty (stesso JWT del login con password). */
export async function startBeautySession(userId: string, viaFusion: boolean): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await setSessionCookie(await createSessionToken({ sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId }));
  if (viaFusion) {
    (await cookies()).set(FUSION_SSO_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 86400,
    });
  }
  return user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard";
}

/** Dopo il logout locale: dove mandare il browser (Fusion ID se la sessione era sua). */
export async function postLogoutRedirect(): Promise<string> {
  const store = await cookies();
  const viaFusion = store.get(FUSION_SSO_COOKIE)?.value === "1";
  store.delete(FUSION_SSO_COOKIE);
  if (viaFusion && fusionIdEnabled()) {
    try {
      return await fusionLogoutUrl("/login");
    } catch {
      return "/login";
    }
  }
  return "/login";
}
