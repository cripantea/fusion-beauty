import { NextResponse, type NextRequest } from "next/server";

import { buildFormEmbedScript } from "@/lib/embed-scripts";
import { parseStoredForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

const JS_HEADERS = { "Content-Type": "application/javascript; charset=utf-8", "Access-Control-Allow-Origin": "*" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const form = await prisma.form.findFirst({ where: { id: formId, enabled: true, tenant: { isActive: true } } });
  if (!form) {
    return new NextResponse("// form non disponibile", { status: 404, headers: JS_HEADERS });
  }

  const { fields, settings } = parseStoredForm(form);
  const script = buildFormEmbedScript({
    formId: form.id,
    title: form.title,
    fields,
    settings,
    displayMode: form.displayMode,
    color: form.color,
    welcomeMessage: form.welcomeMessage,
    // Dietro il proxy l'origin della richiesta è l'host interno del container.
    baseUrl: (process.env.APP_BASE_URL ?? request.nextUrl.origin).replace(/\/$/, ""),
  });

  return new NextResponse(script, { headers: { ...JS_HEADERS, "Cache-Control": "public, max-age=60" } });
}
