import { getTenantContext } from "@/lib/auth-context";

import { getServices } from "./actions";
import { ServicesManager } from "./services-manager";

export default async function ServicesPage() {
  await getTenantContext();
  const services = await getServices();

  return (
    <div className="p-8">
      <ServicesManager initialServices={services} />
    </div>
  );
}
