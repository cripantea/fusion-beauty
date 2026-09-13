import { z } from "zod";

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
    if (blockedHosts.includes(hostname)) {
      return false;
    }

    if (/^(10|127|192\.168)\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const icalImportSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Inserisci l'URL del calendario da importare.")
    .refine(isSafeExternalUrl, "Inserisci un URL http/https pubblico valido."),
});

export type IcalImportFormValues = z.infer<typeof icalImportSchema>;
