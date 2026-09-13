import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { WidgetPreview } from "./widget-preview";

export default async function WidgetPage() {
  const { tenantId } = await getTenantContext();

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true, name: true },
  });

  return (
    <div className="p-8">
      <WidgetPreview tenantSlug={tenant.slug} tenantName={tenant.name} />
    </div>
  );
}
