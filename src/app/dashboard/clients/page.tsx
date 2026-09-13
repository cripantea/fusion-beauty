import { getTenantContext } from "@/lib/auth-context";

import { getClients } from "./actions";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  await getTenantContext();
  const clients = await getClients();

  return (
    <div className="p-8">
      <ClientsManager initialClients={clients} />
    </div>
  );
}
