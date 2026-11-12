import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { WidgetPreview } from "./widget-preview";

export default async function WidgetPage() {
  const { tenantId } = await getTenantContext();

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true, name: true },
  });

  const services = await prisma.service.findMany({
    where: { tenantId, isActive: true, isOnlineBookingEnabled: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <WidgetPreview tenantSlug={tenant.slug} tenantName={tenant.name} services={services} />;
}
