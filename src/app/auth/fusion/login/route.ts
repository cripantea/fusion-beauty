import { fusionIdEnabled, startFusionLogin } from "@/lib/fusion-kit";

export const dynamic = "force-dynamic";

/** Porta a Fusion ID. ?google=1 va dritto a "Continua con Google"; ?returnTo=/percorso per tornare lì. */
export async function GET(request: Request) {
  if (!fusionIdEnabled()) return Response.redirect(new URL("/login", request.url), 302);
  const url = new URL(request.url);
  return startFusionLogin(request, {
    returnTo: url.searchParams.get("returnTo"),
    google: url.searchParams.get("google") === "1",
  });
}
