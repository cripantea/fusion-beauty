import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getTenantContext, TenantContextError } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BLACK = rgb(0.08, 0.08, 0.08);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.85, 0.85, 0.85);

function plainResponse(message: string, status: number) {
  return new NextResponse(message, { status, headers: { "Cache-Control": "private, no-store" } });
}

function toFilenamePart(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "cliente"
  );
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const clientId = request.nextUrl.searchParams.get("clientId");

  if (!clientId) {
    return plainResponse("Missing clientId", 400);
  }

  let tenantId: string;
  try {
    ({ tenantId } = await getTenantContext());
  } catch (error) {
    if (error instanceof TenantContextError) {
      return plainResponse("Forbidden", 403);
    }
    throw error;
  }

  const [template, client] = await Promise.all([
    prisma.consentTemplate.findFirst({
      where: { id, tenantId },
      select: { title: true, body: true },
    }),
    prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    }),
  ]);

  if (!template) {
    return plainResponse("Template not found", 404);
  }
  if (!client) {
    return plainResponse("Client not found", 404);
  }

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const supported = new Set(regular.getCharacterSet());
  function clean(text: string) {
    return Array.from(text.replace(/\t/g, "    ").replace(/\r/g, ""))
      .map((char) => (char === "\n" || supported.has(char.codePointAt(0)!) ? char : "?"))
      .join("");
  }

  function wrapText(text: string, font: typeof regular, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const paragraph of clean(text).split("\n")) {
      if (paragraph.trim() === "") {
        lines.push("");
        continue;
      }
      let current = "";
      for (const word of paragraph.split(" ")) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          current = candidate;
          continue;
        }
        if (current) lines.push(current);
        current = "";
        let chunk = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, size) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = "";
          }
          chunk += char;
        }
        current = chunk;
      }
      lines.push(current);
    }
    return lines;
  }

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(height: number) {
    if (y - height < MARGIN + 20) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawParagraph(
    text: string,
    options: { font?: typeof regular; size?: number; color?: ReturnType<typeof rgb>; indent?: number } = {}
  ) {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.4;
    for (const line of wrapText(text, font, size, CONTENT_WIDTH - indent)) {
      ensureSpace(lineHeight);
      y -= lineHeight;
      if (line) {
        page.drawText(line, { x: MARGIN + indent, y, size, font, color: options.color ?? BLACK });
      }
    }
  }

  function drawRule() {
    ensureSpace(12);
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: LIGHT,
    });
    y -= 4;
  }

  const today = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date());

  drawParagraph(template.title, { font: bold, size: 18 });
  y -= 6;
  drawRule();

  y -= 4;
  const boxTop = y;
  y -= 6;
  drawParagraph(`${client.firstName} ${client.lastName}`, { font: bold, size: 11 });
  drawParagraph(client.phone, { size: 10, color: GRAY });
  drawParagraph(client.email ?? "-", { size: 10, color: GRAY });
  drawParagraph(`Data: ${today}`, { size: 10, color: GRAY });
  y -= 4;
  page.drawRectangle({
    x: MARGIN - 6,
    y,
    width: CONTENT_WIDTH + 12,
    height: boxTop - y,
    borderColor: LIGHT,
    borderWidth: 0.7,
    color: rgb(0.97, 0.97, 0.97),
    opacity: 0.5,
  });

  y -= 10;
  drawRule();
  y -= 6;

  drawParagraph(template.body, { size: 10 });

  const signatureSpaceNeeded = 80;
  ensureSpace(signatureSpaceNeeded + 20);
  y -= 24;

  const lineY = y - 20;
  page.drawLine({
    start: { x: MARGIN, y: lineY },
    end: { x: MARGIN + 200, y: lineY },
    thickness: 0.7,
    color: BLACK,
  });
  page.drawText(clean("Il Centro ____________"), {
    x: MARGIN,
    y: lineY + 4,
    size: 9,
    font: regular,
    color: GRAY,
  });

  page.drawLine({
    start: { x: MARGIN + 260, y: lineY },
    end: { x: MARGIN + 460, y: lineY },
    thickness: 0.7,
    color: BLACK,
  });
  page.drawText(clean("Il/La Cliente ____________"), {
    x: MARGIN + 260,
    y: lineY + 4,
    size: 9,
    font: regular,
    color: GRAY,
  });

  y = lineY - 16;

  const pages = doc.getPages();
  pages.forEach((current, index) => {
    current.drawText(
      clean(`${template.title} - pagina ${index + 1} di ${pages.length}`),
      { x: MARGIN, y: MARGIN - 20, size: 8, font: regular, color: GRAY }
    );
  });

  const pdfBytes = await doc.save();
  const filename = `consenso-${toFilenamePart(client.lastName)}.pdf`;

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdfBytes.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
