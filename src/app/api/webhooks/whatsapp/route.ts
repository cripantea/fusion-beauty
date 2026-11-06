import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { ingestWebhookPayload } from "@/lib/whatsapp";

/**
 * Webhook Meta inoltrato da Fusion WA (URL impostato nell'App "Fusion Beauty" su
 * Fusion WA). Il forwarder non aggiunge intestazioni proprie, quindi il segreto
 * condiviso sta nell'URL: .../api/webhooks/whatsapp?token=<FUSION_WA_WEBHOOK_TOKEN>.
 * I messaggi vengono instradati al centro tramite il phone_number_id.
 */
function validToken(token: string | null) {
  const expected = process.env.FUSION_WA_WEBHOOK_TOKEN;
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!validToken(request.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await ingestWebhookPayload(payload);
  } catch (err) {
    // 500: Fusion WA ritenta la consegna.
    console.error("[whatsapp webhook] elaborazione non riuscita:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
