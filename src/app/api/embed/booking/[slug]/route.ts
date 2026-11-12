import { NextResponse, type NextRequest } from "next/server";

import { buildBookingEmbedScript } from "@/lib/embed-scripts";
import { prisma } from "@/lib/prisma";

const JS_HEADERS = { "Content-Type": "application/javascript; charset=utf-8", "Access-Control-Allow-Origin": "*" };

/**
 * Script dell'agenda di prenotazione da incollare in qualsiasi sito:
 * <script src=".../api/embed/booking/<slug>?mode=popup&text=Prenota&color=%23..." async></script>
 * &cerca=laser,pedicure: solo i trattamenti con queste parole nel nome.
 * &stile=elegante&font=Montserrat&accento=%23hex&sfondo=%23hex: agenda nello stile del sito.
 * mode=link: nessun elemento, l'agenda si apre dai pulsanti del sito con l'attributo data-fusion-beauty-booking.
 * Agenda personalizzata: &servizi=<id>,<id> (solo quei trattamenti), &tinta=1 (colore
 * anche dentro l'agenda), &intestazione=0 (senza logo e nome del centro).
 * Sul tag script, data-nome / data-cognome / data-telefono / data-email precompilano i dati.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { name: true, slug: true, isActive: true } });
  if (!tenant?.isActive) {
    return new NextResponse("// prenotazione non disponibile", { status: 404, headers: JS_HEADERS });
  }

  const query = request.nextUrl.searchParams;
  const modeParam = query.get("mode");
  const mode = modeParam === "button" || modeParam === "popup" || modeParam === "link" ? modeParam : "inline";
  const colorParam = query.get("color") ?? "";
  const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorParam) ? colorParam : "#1f3d36";
  const text = (query.get("text") ?? "").trim().slice(0, 60) || "Prenota un trattamento";
  const services = (query.get("servizi") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[a-z0-9]{10,40}$/i.test(id))
    .slice(0, 50);

  const script = buildBookingEmbedScript({
    slug: tenant.slug,
    title: `Prenota – ${tenant.name}`,
    baseUrl: (process.env.APP_BASE_URL ?? request.nextUrl.origin).replace(/\/$/, ""),
    mode,
    text,
    color,
    services,
    search: (query.get("cerca") ?? "").replace(/[^\p{L}\p{N} ,'-]/gu, "").trim().slice(0, 300),
    theme: Object.fromEntries(
      [
        ["stile", query.get("stile") === "elegante" ? "elegante" : ""],
        ["font", /^[A-Za-z0-9 ]{1,60}$/.test(query.get("font") ?? "") ? (query.get("font") as string) : ""],
        ["accento", /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(query.get("accento") ?? "") ? (query.get("accento") as string) : ""],
        ["sfondo", /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(query.get("sfondo") ?? "") ? (query.get("sfondo") as string) : ""],
      ].filter(([, value]) => value)
    ),
    tint: query.get("tinta") === "1",
    header: query.get("intestazione") !== "0",
  });

  return new NextResponse(script, { headers: { ...JS_HEADERS, "Cache-Control": "public, max-age=60" } });
}
