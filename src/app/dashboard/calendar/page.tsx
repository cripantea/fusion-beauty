import { endOfWeek, format, startOfWeek } from "date-fns";

import { getClients } from "@/app/dashboard/clients/actions";
import { getServices } from "@/app/dashboard/services/actions";
import { getTenantContext } from "@/lib/auth-context";

import { getAppointments, getOperators } from "./actions";
import { CalendarManager } from "./calendar-manager";

export default async function CalendarPage() {
  await getTenantContext();

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const [appointments, clients, services, operators] = await Promise.all([
    getAppointments({ start: weekStart, end: weekEnd }),
    getClients(),
    getServices({ status: "active" }),
    getOperators(),
  ]);

  return (
    <div className="p-8">
      <CalendarManager
        initialAppointments={appointments}
        initialDate={format(today, "yyyy-MM-dd")}
        clients={clients}
        services={services}
        operators={operators}
      />
    </div>
  );
}
