import { NextResponse } from "next/server";

import { startBeautySession } from "@/lib/fusion-id";
import { verifyImpersonationToken } from "@/lib/fusion-kit";

export const dynamic = "force-dynamic";

/** "Entra come" da Fusion Control: link firmato valido 60 secondi, registrato nel registro di Control. */
export async function GET(request: Request) {
  const base = process.env.FUSION_ID_APP_URL || new URL(request.url).origin;
  const target = verifyImpersonationToken(new URL(request.url).searchParams.get("token") ?? "");
  if (!target) return NextResponse.redirect(new URL("/login?error=Link%20scaduto", base), 302);
  const home = await startBeautySession(target.userId, false);
  return NextResponse.redirect(new URL(home, base), 302);
}
