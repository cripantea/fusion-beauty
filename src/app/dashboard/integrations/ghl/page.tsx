import { requireTenantAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { GhlImport } from "./ghl-import";

export default async function GhlImportPage() {
  const { tenantId } = await requireTenantAdmin();
  const imports = await prisma.dataImport.findMany({ where: { tenantId, source: "GHL" }, orderBy: { createdAt: "desc" }, take: 5 });
  return (
    <GhlImport
      imports={imports.map((i) => ({
        id: i.id,
        status: i.status,
        stats: i.stats as Record<string, number>,
        error: i.error,
        createdAt: i.createdAt.toISOString(),
        finishedAt: i.finishedAt?.toISOString() ?? null,
      }))}
    />
  );
}
