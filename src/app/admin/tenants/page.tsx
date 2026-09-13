import { getTenants } from "./actions";
import { TenantsManager } from "./tenants-manager";

export default async function AdminTenantsPage() {
  const tenants = await getTenants();

  return <TenantsManager initialTenants={tenants} />;
}
