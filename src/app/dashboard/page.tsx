import { getOperators } from "@/app/dashboard/calendar/actions";
import { getClients } from "@/app/dashboard/clients/actions";
import { getServices } from "@/app/dashboard/services/actions";
import { getAuthContext } from "@/lib/auth-context";

import { getDashboardMetrics, getTodayAppointments } from "./actions";
import { DashboardManager } from "./dashboard-manager";

export default async function DashboardPage() {
  const { user } = await getAuthContext();

  const dashboardData = user.tenantId
    ? await Promise.all([
        getDashboardMetrics(),
        getTodayAppointments(),
        getClients(),
        getServices({ status: "active" }),
        getOperators(),
      ])
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Panoramica operativa del centro.</p>
      </div>

      {dashboardData ? (
        <DashboardManager
          initialMetrics={dashboardData[0]}
          initialAppointments={dashboardData[1]}
          clients={dashboardData[2]}
          services={dashboardData[3]}
          operators={dashboardData[4]}
        />
      ) : (
        <p className="text-muted-foreground">
          Accedi come amministratore di un centro per vedere la dashboard operativa.
        </p>
      )}
    </div>
  );
}
