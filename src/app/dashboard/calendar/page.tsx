import { addDays, endOfWeek, startOfWeek, subDays } from "date-fns";

import { getClients } from "@/app/dashboard/clients/actions";
import { getServices } from "@/app/dashboard/services/actions";
import { getTenantContext } from "@/lib/auth-context";
import { isConsentsEnabled } from "@/lib/consents";
import { isPaymentsEnabled } from "@/lib/payments-mode";
import { getStripeStatus } from "@/lib/stripe-tenant";

import { getAppointments, getOperators } from "./actions";
import { getStaffAbsences, getStaffBlocks } from "./block-actions";
import { CalendarManager } from "./calendar-manager";

export default async function CalendarPage() {
  const { user, tenantId } = await getTenantContext();

  // "Oggi" del centro (ora italiana), non del server che gira in UTC.
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${todayKey}T12:00:00Z`);
  // Settimana larga di un giorno per lato: copre la differenza tra UTC e ora italiana.
  const weekStart = subDays(startOfWeek(today, { weekStartsOn: 1 }), 1);
  const weekEnd = addDays(endOfWeek(today, { weekStartsOn: 1 }), 1);

  const [appointments, blocks, absences, clients, services, operators, paymentsEnabled, stripe, consentsEnabled] = await Promise.all([
    getAppointments({ start: weekStart, end: weekEnd }),
    getStaffBlocks({ start: weekStart, end: weekEnd }),
    getStaffAbsences({ start: weekStart, end: weekEnd }),
    getClients(),
    getServices({ status: "active" }),
    getOperators(),
    isPaymentsEnabled(tenantId),
    getStripeStatus(tenantId),
    isConsentsEnabled(tenantId),
  ]);

  return (
    <CalendarManager
      initialAppointments={appointments}
      initialBlocks={blocks}
      initialAbsences={absences}
      initialDate={todayKey}
      clients={clients}
      services={services}
      operators={operators}
      isAdmin={user.role === "ADMIN"}
      currentUserId={user.id}
      paymentsEnabled={paymentsEnabled}
      onlinePayments={stripe.connected}
      consentsEnabled={consentsEnabled}
    />
  );
}
