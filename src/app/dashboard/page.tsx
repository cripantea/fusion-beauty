import Link from "next/link";

import { getOperators } from "@/app/dashboard/calendar/actions";
import { getClients } from "@/app/dashboard/clients/actions";
import { getServices } from "@/app/dashboard/services/actions";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            {user.firstName} {user.lastName} — {user.role}
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline">
            Esci
          </Button>
        </form>
      </div>

      {dashboardData ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/dashboard/services" />}
            >
              Catalogo trattamenti
            </Button>
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/dashboard/clients" />}
            >
              Anagrafica clienti
            </Button>
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/dashboard/calendar" />}
            >
              Calendario
            </Button>
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/dashboard/widget" />}
            >
              Widget prenotazione
            </Button>
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/dashboard/integrations/calendar" />}
            >
              Integrazioni calendario
            </Button>
            {user.role === "ADMIN" ? (
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link href="/dashboard/staff" />}
              >
                Staff
              </Button>
            ) : null}
          </div>

          <DashboardManager
            initialMetrics={dashboardData[0]}
            initialAppointments={dashboardData[1]}
            clients={dashboardData[2]}
            services={dashboardData[3]}
            operators={dashboardData[4]}
          />
        </>
      ) : (
        <p className="text-muted-foreground">
          Accedi come amministratore di un centro per vedere la dashboard operativa.
        </p>
      )}
    </div>
  );
}
