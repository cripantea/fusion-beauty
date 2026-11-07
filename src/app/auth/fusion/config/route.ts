import { fusionIdEnabled, legacyLoginEnabled } from "@/lib/fusion-kit";

export const dynamic = "force-dynamic";

/** Cosa mostrare nella pagina di login (che è un client component). */
export function GET() {
  return Response.json({
    enabled: fusionIdEnabled(),
    google: fusionIdEnabled() && Boolean(process.env.FUSION_ID_GOOGLE_IDP_ID),
    legacy: legacyLoginEnabled(),
  });
}
