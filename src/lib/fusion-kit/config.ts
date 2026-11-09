// Fusion Kit — configurazione dalle variabili d'ambiente (generate da fusion-id/scripts/setup.mjs).

export type FusionConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  googleIdpId: string;
  appUrl: string;
  /** on = resta anche il vecchio login con password (transizione); off = solo Fusion ID. */
  legacyLogin: boolean;
  product: string;
  kitSecret: string;
  controlUrl: string;
};

const trim = (v: string | undefined) => (v ?? "").trim().replace(/\/$/, "");

/** true se Fusion ID è configurato in questo ambiente. Senza, il prodotto usa solo il login di prima. */
export function fusionIdEnabled(): boolean {
  return Boolean(process.env.FUSION_ID_ISSUER && process.env.FUSION_ID_CLIENT_ID && process.env.FUSION_ID_CLIENT_SECRET);
}

/** true se il vecchio login con password deve restare visibile e attivo. */
export function legacyLoginEnabled(): boolean {
  return !fusionIdEnabled() || (process.env.FUSION_ID_LEGACY_LOGIN ?? "on").toLowerCase() !== "off";
}

export function fusionConfig(): FusionConfig {
  if (!fusionIdEnabled()) throw new Error("Fusion ID non configurato (FUSION_ID_ISSUER/CLIENT_ID/CLIENT_SECRET)");
  return {
    issuer: trim(process.env.FUSION_ID_ISSUER),
    clientId: process.env.FUSION_ID_CLIENT_ID!.trim(),
    clientSecret: process.env.FUSION_ID_CLIENT_SECRET!.trim(),
    googleIdpId: (process.env.FUSION_ID_GOOGLE_IDP_ID ?? "").trim(),
    appUrl: trim(process.env.FUSION_ID_APP_URL),
    legacyLogin: legacyLoginEnabled(),
    product: (process.env.FUSION_KIT_PRODUCT ?? "").trim(),
    kitSecret: (process.env.FUSION_KIT_SECRET ?? "").trim(),
    controlUrl: trim(process.env.FUSION_CONTROL_URL),
  };
}

/** Configurazione del Kit di servizio (API admin, errori, widget): non richiede il login OIDC. */
export function kitConfig() {
  return {
    product: (process.env.FUSION_KIT_PRODUCT ?? "").trim(),
    secret: (process.env.FUSION_KIT_SECRET ?? "").trim(),
    controlUrl: trim(process.env.FUSION_CONTROL_URL),
  };
}
