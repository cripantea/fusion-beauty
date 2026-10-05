import { prisma } from "@/lib/prisma";

import { getTenantContext } from "@/lib/auth-context";

import { getClients } from "./actions";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  const { tenantId } = await getTenantContext();
  const [clients, tenant] = await Promise.all([
    getClients(),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }),
  ]);

  return <ClientsManager initialClients={clients} tenantSlug={tenant?.slug ?? null} />;
}
