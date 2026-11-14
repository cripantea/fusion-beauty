import type { NextRequest } from "next/server";

import { getTenantContext, TenantContextError } from "@/lib/auth-context";
import { fetchMedia } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";

/**
 * Foto o vocale di un messaggio WhatsApp, per vederlo/ascoltarlo in Messaggi.
 * Il file sta su Meta: lo scarica Fusion WA (che ha il token) e qui si gira al browser.
 * Meta tiene i file circa 30 giorni.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantContext());
  } catch (error) {
    if (error instanceof TenantContextError) return new Response("Forbidden", { status: 403 });
    throw error;
  }

  const { id } = await params;
  const message = await prisma.whatsappMessage.findFirst({ where: { id, tenantId }, select: { mediaId: true } });
  if (!message?.mediaId) return new Response("Not found", { status: 404 });

  const upstream = await fetchMedia(tenantId, message.mediaId);
  if (!upstream?.ok || !upstream.body) return new Response("Media unavailable", { status: upstream?.status === 415 ? 415 : 502 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
