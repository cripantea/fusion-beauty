import { prisma } from "@/lib/prisma";

export type PublicServiceDTO = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
};

export type PublicTenantWidgetData = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  services: PublicServiceDTO[];
};

/**
 * Public, unauthenticated read: only active tenants and only their
 * active + online-bookable services are ever returned.
 */
export async function getPublicTenantWidgetData(
  slug: string
): Promise<PublicTenantWidgetData | null> {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });

  if (!tenant || !tenant.isActive) {
    return null;
  }

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, isActive: true, isOnlineBookingEnabled: true },
    orderBy: { name: "asc" },
  });

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
    },
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price.toNumber(),
      durationMinutes: service.durationMinutes,
    })),
  };
}
