import { NextResponse, type NextRequest } from "next/server";

import { buildBookingEmbedScript } from "@/lib/embed-scripts";
import { prisma } from "@/lib/prisma";

const JS_HEADERS = { "Content-Type": "application/javascript; charset=utf-8", "Access-Control-Allow-Origin": "*" };

/**
 * Script dell'agenda di prenotazione da incollare in qualsiasi sito:
 * <script src=".../api/embed/booking/<slug>?mode=popup&text=Prenota&color=%23..." async></script>
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { name: true, slug: true, isActive: true } });
  if (!tenant?.isActive) {
    return new NextResponse("// prenotazione non disponibile", { status: 404, headers: JS_HEADERS });
  }

  const query = request.nextUrl.searchParams;
  const modeParam = query.get("mode");
  const mode = modeParam === "button" || modeParam === "popup" ? modeParam : "inline";
  const colorParam = query.get("color") ?? "";
  const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorParam) ? colorParam : "#1f3d36";
  const text = (query.get("text") ?? "").trim().slice(0, 60) || "Prenota un trattamento";

  const script = buildBookingEmbedScript({
    slug: tenant.slug,
    title: `Prenota – ${tenant.name}`,
    baseUrl: (process.env.APP_BASE_URL ?? request.nextUrl.origin).replace(/\/$/, ""),
    mode,
    text,
    color,
  });

  return new NextResponse(script, { headers: { ...JS_HEADERS, "Cache-Control": "public, max-age=60" } });
}
