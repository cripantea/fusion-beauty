import { normalizePhoneForWhatsapp } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * Cliente del centro con lo stesso numero, comunque sia scritto in scheda
 * ("333 444 5566", "+39 3334445566", "0039…"): si confrontano solo le cifre.
 */
export async function findClientIdByPhone(
  tenantId: string,
  phone: string,
  // Dentro una transazione (prenotazione online) si legge con la stessa.
  db: Pick<typeof prisma, "$queryRaw"> = prisma
): Promise<string | null> {
  const normalized = normalizePhoneForWhatsapp(phone);
  const tail = normalized.slice(-9);
  if (tail.length < 6) return null;
  const candidates = await db.$queryRaw<{ id: string; phone: string }[]>`
    SELECT id, phone FROM clients
    WHERE "tenantId" = ${tenantId}
      AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${`%${tail}`}
    ORDER BY "createdAt" ASC
    LIMIT 10`;
  return candidates.find((c) => normalizePhoneForWhatsapp(c.phone) === normalized)?.id ?? null;
}
