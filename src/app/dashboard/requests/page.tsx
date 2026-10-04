import { getOperators } from "@/app/dashboard/calendar/actions";
import { getClients } from "@/app/dashboard/clients/actions";
import { getServices } from "@/app/dashboard/services/actions";
import { getTenantContext } from "@/lib/auth-context";

import { getOnlineRequests } from "./actions";
import { RequestsManager } from "./requests-manager";

export default async function RequestsPage() {
  await getTenantContext();

  const [requests, clients, services, operators] = await Promise.all([
    getOnlineRequests(),
    getClients(),
    getServices({ status: "active" }),
    getOperators(),
  ]);

  return (
    <RequestsManager
      initialRequests={requests}
      clients={clients}
      services={services}
      operators={operators}
    />
  );
}
