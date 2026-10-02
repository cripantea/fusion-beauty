import { getServices } from "@/app/dashboard/services/actions";
import { requireTenantAdmin } from "@/lib/auth-context";

import { getConsentTemplates } from "./actions";
import { ConsentsManager } from "./consents-manager";

export default async function ConsentsPage() {
  await requireTenantAdmin();

  const [templates, services] = await Promise.all([
    getConsentTemplates(),
    getServices({ status: "active" }),
  ]);

  return (
    <ConsentsManager
      initialTemplates={templates}
      services={services.map((service) => ({ id: service.id, name: service.name }))}
    />
  );
}
