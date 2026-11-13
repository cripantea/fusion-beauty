import { prisma } from "@/lib/prisma";

import { getTenantContext } from "@/lib/auth-context";

import { getClients } from "./actions";
import { getDuplicateGroups } from "./duplicate-actions";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  const { tenantId } = await getTenantContext();
  const [clients, tenant, duplicates] = await Promise.all([
    getClients(),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }),
    getDuplicateGroups(),
  ]);

  return <ClientsManager initialClients={clients} tenantSlug={tenant?.slug ?? null} duplicates={duplicates} />;
}
