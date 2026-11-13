import { getOperators } from "@/app/dashboard/calendar/actions";
import { getClients } from "@/app/dashboard/clients/actions";
import { getServices } from "@/app/dashboard/services/actions";
import { getAuthContext } from "@/lib/auth-context";
import { isConsentsEnabled } from "@/lib/consents";
import { isPaymentsEnabled } from "@/lib/payments-mode";
import { getStripeStatus } from "@/lib/stripe-tenant";

import { getDashboardData } from "./actions";
import { DashboardManager } from "./dashboard-manager";

export default async function DashboardPage() {
  const { user } = await getAuthContext();

  if (!user.tenantId) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Accedi come amministratrice di un centro per vedere la dashboard operativa.
        </p>
      </div>
    );
  }

  const [data, clients, services, operators, paymentsEnabled, stripe, consentsEnabled] = await Promise.all([
    getDashboardData(),
    getClients(),
    getServices({ status: "active" }),
    getOperators(),
    isPaymentsEnabled(user.tenantId),
    getStripeStatus(user.tenantId),
    isConsentsEnabled(user.tenantId),
  ]);

  return (
    <DashboardManager
      firstName={user.firstName}
      initialData={data}
      clients={clients}
      services={services}
      operators={operators}
      paymentsEnabled={paymentsEnabled}
      onlinePayments={stripe.connected}
      consentsEnabled={consentsEnabled}
    />
  );
}
