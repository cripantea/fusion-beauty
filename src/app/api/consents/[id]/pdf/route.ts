import { createHash } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getTenantContext, TenantContextError } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { readStorageFile } from "@/lib/storage";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function plainResponse(message: string, status: number) {
  return new NextResponse(message, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** Solo caratteri sicuri nel nome file scaricato. */
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

// Il file non è mai in /public: passa sempre da qui, dopo sessione e controllo del tenant.
// Senza sessione getTenantContext() reindirizza al login.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let tenantId: string;
  try {
    ({ tenantId } = await getTenantContext());
  } catch (error) {
    if (error instanceof TenantContextError) {
      return plainResponse("Forbidden", 403);
    }
    throw error;
  }

  const record = await prisma.consentRecord.findFirst({
    where: { id, tenantId },
    select: {
      pdfKey: true,
      documentHash: true,
      signedAt: true,
      client: { select: { lastName: true } },
    },
  });

  if (!record || !record.pdfKey) {
    return plainResponse("Not found", 404);
  }

  let pdf: Buffer;
  try {
    pdf = await readStorageFile(record.pdfKey);
  } catch (error) {
    console.error(`[consents] cannot read PDF for record ${id}`, error);
    return plainResponse("Not found", 404);
  }

  if (record.documentHash && createHash("sha256").update(pdf).digest("hex") !== record.documentHash) {
    console.error(`[consents] integrity check failed for record ${id}`);
    return plainResponse("Document integrity check failed", 500);
  }

  const date = (record.signedAt ?? new Date()).toISOString().slice(0, 10);
  const filename = `consenso-${toFilenamePart(record.client.lastName)}-${date}.pdf`;
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
