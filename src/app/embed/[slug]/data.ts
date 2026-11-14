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
    phone: string | null;
    /** Spento: niente prenotazione, solo l'avviso "per ora chiamaci". */
    onlineBookingEnabled: boolean;
    /** Con la prenotazione spenta: form di richiesta appuntamento al posto dell'agenda. */
    bookingFormId: string | null;
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

  // Il form vale solo se è del centro ed è attivo.
  const bookingForm =
    !tenant.onlineBookingEnabled && tenant.bookingFormId
      ? await prisma.form.findFirst({ where: { id: tenant.bookingFormId, tenantId: tenant.id, enabled: true }, select: { id: true } })
      : null;

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
      phone: tenant.phone,
      onlineBookingEnabled: tenant.onlineBookingEnabled,
      bookingFormId: bookingForm?.id ?? null,
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
